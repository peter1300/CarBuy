import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useAuth } from './AuthContext'
import {
  callInboxChannel,
  callSessionChannel,
  getMediaStream,
  ICE_SERVERS,
  stopMediaStream,
  type ActiveCall,
  type CallMode,
  type CallParticipant,
  type CallSignalPayload,
} from '../lib/callMedia'
import type { Listing } from '../data/listings'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type StartCallArgs = {
  listing: Listing
  mode: CallMode
}

type CallContextValue = {
  call: ActiveCall | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  startCall: (args: StartCallArgs) => Promise<void>
  acceptIncoming: () => Promise<void>
  rejectIncoming: () => void
  endCall: () => void
  toggleMute: () => void
  toggleCamera: () => void
}

const CallContext = createContext<CallContextValue | null>(null)

const RING_TIMEOUT_MS = 45_000

function initialsFrom(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function toParticipant(listing: Listing): CallParticipant {
  return {
    name: listing.seller.name,
    initials: initialsFrom(listing.seller.name),
    type: listing.seller.type,
    avatarUrl: listing.videoPoster,
  }
}

async function waitUntilSubscribed(channel: RealtimeChannel): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('Híváscsatorna időtúllépés.'))
    }, 10_000)

    void channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        window.clearTimeout(timeout)
        resolve()
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        window.clearTimeout(timeout)
        reject(new Error('Hívásjelzés csatlakozás sikertelen.'))
      }
    })
  })
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [call, setCall] = useState<ActiveCall | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)

  const callRef = useRef<ActiveCall | null>(null)
  const userRef = useRef(user)
  const localStreamRef = useRef<MediaStream | null>(null)
  const pendingInviteRef = useRef<CallSignalPayload | null>(null)
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null)
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([])
  const ringTimerRef = useRef<number | null>(null)
  const inboxRef = useRef<RealtimeChannel | null>(null)
  const sessionRef = useRef<RealtimeChannel | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const signalHandlerRef = useRef<(data: CallSignalPayload) => void>(() => {})

  useEffect(() => {
    callRef.current = call
  }, [call])

  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    localStreamRef.current = localStream
  }, [localStream])

  const clearRingTimer = useCallback(() => {
    if (ringTimerRef.current) {
      window.clearTimeout(ringTimerRef.current)
      ringTimerRef.current = null
    }
  }, [])

  const closePeer = useCallback(() => {
    pcRef.current?.close()
    pcRef.current = null
    pendingOfferRef.current = null
    pendingIceRef.current = []
    setRemoteStream(null)
  }, [])

  const cleanupMedia = useCallback(() => {
    closePeer()
    setLocalStream((prev) => {
      stopMediaStream(prev)
      return null
    })
    localStreamRef.current = null
  }, [closePeer])

  const leaveSession = useCallback(async () => {
    const ch = sessionRef.current
    sessionRef.current = null
    if (ch) {
      try {
        await supabase.removeChannel(ch)
      } catch {
        // ignore
      }
    }
  }, [])

  const sendSignal = useCallback(async (channel: RealtimeChannel, payload: CallSignalPayload) => {
    const result = await channel.send({
      type: 'broadcast',
      event: 'signal',
      payload,
    })
    if (result !== 'ok') {
      console.warn('[CarBuy] call signal send failed', result)
    }
  }, [])

  const baseSignal = useCallback(
    (type: CallSignalPayload['type'], extra: Partial<CallSignalPayload> = {}): CallSignalPayload | null => {
      const current = callRef.current
      const invite = pendingInviteRef.current
      if (!current && !invite) return null
      return {
        type,
        callId: current?.id ?? invite!.callId,
        listingId: current?.listingId ?? invite!.listingId,
        listingTitle: current?.listingTitle ?? invite!.listingTitle,
        mode: current?.mode ?? invite!.mode,
        fromName: userRef.current?.name ?? 'Felhasználó',
        fromUserId: userRef.current?.id,
        ownerId: invite?.ownerId,
        ...extra,
      }
    },
    [],
  )

  const flushIce = useCallback(async (pc: RTCPeerConnection) => {
    const queued = pendingIceRef.current
    pendingIceRef.current = []
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate)
      } catch (err) {
        console.warn('[CarBuy] queued ICE failed', err)
      }
    }
  }, [])

  const createPeer = useCallback(
    (stream: MediaStream) => {
      closePeer()
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      pcRef.current = pc

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream)
      })

      pc.ontrack = (event) => {
        if (event.streams[0]) {
          setRemoteStream(event.streams[0])
          return
        }
        setRemoteStream((prev) => {
          const next = prev ?? new MediaStream()
          next.addTrack(event.track)
          return next
        })
      }

      pc.onicecandidate = (event) => {
        if (!event.candidate || !sessionRef.current) return
        const payload = baseSignal('ice', { candidate: event.candidate.toJSON() })
        if (payload) void sendSignal(sessionRef.current, payload)
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          setCall((prev) =>
            prev
              ? {
                  ...prev,
                  phase: 'failed',
                  error: 'A peer kapcsolat megszakadt. Próbáld újra.',
                }
              : prev,
          )
        }
      }

      return pc
    },
    [baseSignal, closePeer, sendSignal],
  )

  const startAsOfferer = useCallback(async () => {
    const stream = localStreamRef.current
    const current = callRef.current
    if (!stream || !current || !sessionRef.current) return

    const pc = createPeer(stream)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await flushIce(pc)

    const payload = baseSignal('offer', { sdp: pc.localDescription ?? offer })
    if (payload) await sendSignal(sessionRef.current, payload)
  }, [baseSignal, createPeer, flushIce, sendSignal])

  const applyRemoteOffer = useCallback(
    async (sdp: RTCSessionDescriptionInit) => {
      const stream = localStreamRef.current
      if (!stream || !sessionRef.current) {
        pendingOfferRef.current = sdp
        return
      }

      let pc = pcRef.current
      if (!pc) pc = createPeer(stream)

      await pc.setRemoteDescription(sdp)
      await flushIce(pc)

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      const payload = baseSignal('answer', { sdp: pc.localDescription ?? answer })
      if (payload) await sendSignal(sessionRef.current, payload)

      setCall((prev) =>
        prev
          ? {
              ...prev,
              phase: 'connected',
              startedAt: prev.startedAt ?? Date.now(),
            }
          : prev,
      )
    },
    [baseSignal, createPeer, flushIce, sendSignal],
  )

  const joinSession = useCallback(
    async (callId: string) => {
      await leaveSession()
      const session = supabase.channel(callSessionChannel(callId), {
        config: { broadcast: { self: false } },
      })
      session.on('broadcast', { event: 'signal' }, ({ payload }) => {
        signalHandlerRef.current(payload as CallSignalPayload)
      })
      sessionRef.current = session
      await waitUntilSubscribed(session)
      return session
    },
    [leaveSession],
  )

  signalHandlerRef.current = (data: CallSignalPayload) => {
    if (!data?.type || !data.callId) return

    const currentUser = userRef.current
    const currentCall = callRef.current

    if (data.fromUserId && currentUser && data.fromUserId === currentUser.id) {
      if (data.type === 'invite' || data.type === 'offer' || data.type === 'answer' || data.type === 'ice') {
        return
      }
    }

    if (data.type === 'invite') {
      if (!currentUser || !data.ownerId || data.ownerId !== currentUser.id) return
      if (currentCall) return

      pendingInviteRef.current = data
      void joinSession(data.callId).catch((err) => {
        console.warn('[CarBuy] failed to join call session', err)
      })

      setCall({
        id: data.callId,
        listingId: data.listingId,
        listingTitle: data.listingTitle,
        mode: data.mode,
        phase: 'ringing',
        direction: 'incoming',
        remote: {
          name: data.fromName,
          initials: initialsFrom(data.fromName),
          type: 'private',
        },
        muted: false,
        cameraOff: data.mode === 'audio',
      })
      return
    }

    if (data.type === 'accept') {
      if (!currentCall || currentCall.id !== data.callId || currentCall.direction !== 'outgoing') return
      clearRingTimer()
      setCall((prev) =>
        prev
          ? { ...prev, phase: 'connecting' }
          : prev,
      )
      void startAsOfferer()
        .then(() => {
          setCall((prev) =>
            prev && prev.id === data.callId
              ? { ...prev, phase: 'connected', startedAt: Date.now() }
              : prev,
          )
        })
        .catch((err) => {
          console.warn('[CarBuy] offer failed', err)
          setCall((prev) =>
            prev
              ? {
                  ...prev,
                  phase: 'failed',
                  error: 'Nem sikerült felépíteni a videókapcsolatot.',
                }
              : prev,
          )
        })
      return
    }

    if (data.type === 'offer' && data.sdp) {
      if (!currentCall || currentCall.id !== data.callId) {
        pendingOfferRef.current = data.sdp
        return
      }
      void applyRemoteOffer(data.sdp).catch((err) => {
        console.warn('[CarBuy] answer failed', err)
      })
      return
    }

    if (data.type === 'answer' && data.sdp) {
      const pc = pcRef.current
      if (!pc || !currentCall || currentCall.id !== data.callId) return
      void pc
        .setRemoteDescription(data.sdp)
        .then(() => flushIce(pc))
        .catch((err) => console.warn('[CarBuy] setRemote answer failed', err))
      return
    }

    if (data.type === 'ice' && data.candidate) {
      const pc = pcRef.current
      if (!pc || !pc.remoteDescription) {
        pendingIceRef.current.push(data.candidate)
        return
      }
      void pc.addIceCandidate(data.candidate).catch((err) => {
        console.warn('[CarBuy] ICE failed', err)
      })
      return
    }

    if (data.type === 'reject' || data.type === 'end') {
      clearRingTimer()
      if (
        currentCall?.id === data.callId ||
        pendingInviteRef.current?.callId === data.callId
      ) {
        pendingInviteRef.current = null
        cleanupMedia()
        void leaveSession()
        setCall((prev) => (prev ? { ...prev, phase: 'ended' } : null))
        window.setTimeout(() => setCall(null), 800)
      }
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) {
      if (inboxRef.current) {
        void supabase.removeChannel(inboxRef.current)
        inboxRef.current = null
      }
      return
    }

    const channel = supabase.channel(callInboxChannel(user.id), {
      config: { broadcast: { self: false } },
    })

    channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
      signalHandlerRef.current(payload as CallSignalPayload)
    })

    inboxRef.current = channel
    void channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('[CarBuy] call inbox channel error')
      }
    })

    return () => {
      void supabase.removeChannel(channel)
      if (inboxRef.current === channel) inboxRef.current = null
    }
  }, [user?.id])

  const showFailed = useCallback((listing: Listing, mode: CallMode, error: string) => {
    setCall({
      id: crypto.randomUUID(),
      listingId: listing.id,
      listingTitle: listing.title,
      mode,
      phase: 'failed',
      direction: 'outgoing',
      remote: toParticipant(listing),
      muted: false,
      cameraOff: mode === 'audio',
      error,
    })
    window.setTimeout(() => setCall(null), 3200)
  }, [])

  const endCall = useCallback(() => {
    clearRingTimer()
    const payload = baseSignal('end')
    if (payload && sessionRef.current) {
      void sendSignal(sessionRef.current, payload)
    }

    pendingInviteRef.current = null
    cleanupMedia()
    void leaveSession()
    setCall((prev) => (prev ? { ...prev, phase: 'ended' } : null))
    window.setTimeout(() => setCall(null), 900)
  }, [baseSignal, cleanupMedia, clearRingTimer, leaveSession, sendSignal])

  const startCall = useCallback(
    async ({ listing, mode }: StartCallArgs) => {
      if (listing.seller.status !== 'online') {
        showFailed(listing, mode, 'A hirdető jelenleg nem Online — hívás nem indítható.')
        return
      }

      if (!user) {
        showFailed(listing, mode, 'A híváshoz be kell jelentkezned.')
        return
      }

      if (listing.ownerId && listing.ownerId === user.id) {
        showFailed(listing, mode, 'Saját hirdetésedet nem hívhatod fel.')
        return
      }

      if (!listing.ownerId) {
        showFailed(
          listing,
          mode,
          'Ez demó hirdetés — nincs valódi hirdető, aki fogadhatná a hívást.',
        )
        return
      }

      if (!isSupabaseConfigured) {
        showFailed(listing, mode, 'Supabase nincs beállítva — hívásjelzés nem elérhető.')
        return
      }

      clearRingTimer()
      cleanupMedia()
      await leaveSession()

      const callId = crypto.randomUUID()
      setCall({
        id: callId,
        listingId: listing.id,
        listingTitle: listing.title,
        mode,
        phase: 'requesting',
        direction: 'outgoing',
        remote: toParticipant(listing),
        muted: false,
        cameraOff: mode === 'audio',
      })

      try {
        const stream = await getMediaStream(mode)
        localStreamRef.current = stream
        setLocalStream(stream)
      } catch {
        showFailed(
          listing,
          mode,
          'Kamera vagy mikrofon hozzáférés megtagadva. Engedélyezd a böngészőben.',
        )
        return
      }

      const invite: CallSignalPayload = {
        type: 'invite',
        callId,
        listingId: listing.id,
        listingTitle: listing.title,
        mode,
        fromName: user.name,
        fromUserId: user.id,
        ownerId: listing.ownerId,
      }

      try {
        await joinSession(callId)

        const inbox = supabase.channel(callInboxChannel(listing.ownerId), {
          config: { broadcast: { self: false } },
        })
        await waitUntilSubscribed(inbox)
        await sendSignal(inbox, invite)
        await supabase.removeChannel(inbox)

        setCall((prev) => (prev ? { ...prev, phase: 'ringing' } : prev))

        ringTimerRef.current = window.setTimeout(() => {
          setCall((prev) => {
            if (!prev || prev.id !== callId || prev.phase !== 'ringing') return prev
            cleanupMedia()
            void leaveSession()
            return {
              ...prev,
              phase: 'failed',
              error: 'Nincs válasz. A hirdetőnek bejelentkezve a CarBuy oldalon kell lennie.',
            }
          })
          window.setTimeout(() => setCall(null), 3200)
        }, RING_TIMEOUT_MS)
      } catch (err) {
        cleanupMedia()
        await leaveSession()
        showFailed(
          listing,
          mode,
          err instanceof Error ? err.message : 'Hívásjelzés sikertelen.',
        )
      }
    },
    [
      user,
      clearRingTimer,
      cleanupMedia,
      leaveSession,
      sendSignal,
      joinSession,
      showFailed,
    ],
  )

  const acceptIncoming = useCallback(async () => {
    const invite = pendingInviteRef.current
    const current = callRef.current
    if (!invite || !current || current.direction !== 'incoming') return

    setCall((prev) => (prev ? { ...prev, phase: 'connecting' } : prev))

    try {
      const stream = await getMediaStream(invite.mode)
      localStreamRef.current = stream
      setLocalStream(stream)
      createPeer(stream)

      if (sessionRef.current) {
        await sendSignal(sessionRef.current, {
          type: 'accept',
          callId: invite.callId,
          listingId: invite.listingId,
          listingTitle: invite.listingTitle,
          mode: invite.mode,
          fromName: userRef.current?.name ?? 'Hirdető',
          fromUserId: userRef.current?.id,
          ownerId: invite.ownerId,
        })
      }

      if (pendingOfferRef.current) {
        const sdp = pendingOfferRef.current
        pendingOfferRef.current = null
        await applyRemoteOffer(sdp)
      } else {
        setCall((prev) =>
          prev
            ? {
                ...prev,
                phase: 'connected',
                startedAt: Date.now(),
                cameraOff: invite.mode === 'audio',
              }
            : prev,
        )
      }
    } catch {
      setCall((prev) =>
        prev
          ? {
              ...prev,
              phase: 'failed',
              error: 'Nem sikerült elindítani a kamerát / mikrofont.',
            }
          : prev,
      )
      window.setTimeout(() => setCall(null), 2800)
    }
  }, [applyRemoteOffer, createPeer, sendSignal])

  const rejectIncoming = useCallback(() => {
    const invite = pendingInviteRef.current
    if (invite && sessionRef.current) {
      void sendSignal(sessionRef.current, {
        type: 'reject',
        callId: invite.callId,
        listingId: invite.listingId,
        listingTitle: invite.listingTitle,
        mode: invite.mode,
        fromName: userRef.current?.name ?? 'Hirdető',
        fromUserId: userRef.current?.id,
        ownerId: invite.ownerId,
      })
    }
    pendingInviteRef.current = null
    cleanupMedia()
    void leaveSession()
    setCall(null)
  }, [cleanupMedia, leaveSession, sendSignal])

  const toggleMute = useCallback(() => {
    setCall((prev) => {
      if (!prev) return prev
      const nextMuted = !prev.muted
      setLocalStream((stream) => {
        stream?.getAudioTracks().forEach((t) => {
          t.enabled = !nextMuted
        })
        return stream
      })
      return { ...prev, muted: nextMuted }
    })
  }, [])

  const toggleCamera = useCallback(() => {
    setCall((prev) => {
      if (!prev) return prev
      const nextOff = !prev.cameraOff
      setLocalStream((stream) => {
        stream?.getVideoTracks().forEach((t) => {
          t.enabled = !nextOff
        })
        return stream
      })
      return { ...prev, cameraOff: nextOff }
    })
  }, [])

  useEffect(() => {
    return () => {
      clearRingTimer()
      cleanupMedia()
      if (sessionRef.current) void supabase.removeChannel(sessionRef.current)
      if (inboxRef.current) void supabase.removeChannel(inboxRef.current)
    }
  }, [cleanupMedia, clearRingTimer])

  const value = useMemo(
    () => ({
      call,
      localStream,
      remoteStream,
      startCall,
      acceptIncoming,
      rejectIncoming,
      endCall,
      toggleMute,
      toggleCamera,
    }),
    [
      call,
      localStream,
      remoteStream,
      startCall,
      acceptIncoming,
      rejectIncoming,
      endCall,
      toggleMute,
      toggleCamera,
    ],
  )

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>
}

export function useCall() {
  const ctx = useContext(CallContext)
  if (!ctx) throw new Error('useCall must be used within CallProvider')
  return ctx
}
