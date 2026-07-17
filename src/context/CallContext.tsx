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

  const callRef = useRef<ActiveCall | null>(null)
  const userRef = useRef(user)
  const pendingInviteRef = useRef<CallSignalPayload | null>(null)
  const ringTimerRef = useRef<number | null>(null)
  const inboxRef = useRef<RealtimeChannel | null>(null)
  const sessionRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    callRef.current = call
  }, [call])

  useEffect(() => {
    userRef.current = user
  }, [user])

  const clearRingTimer = useCallback(() => {
    if (ringTimerRef.current) {
      window.clearTimeout(ringTimerRef.current)
      ringTimerRef.current = null
    }
  }, [])

  const cleanupMedia = useCallback(() => {
    setLocalStream((prev) => {
      stopMediaStream(prev)
      return null
    })
  }, [])

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

  const signalHandlerRef = useRef<(data: CallSignalPayload) => void>(() => {})

  signalHandlerRef.current = (data: CallSignalPayload) => {
    if (!data?.type || !data.callId) return

    const currentUser = userRef.current
    const currentCall = callRef.current

    if (data.type === 'invite') {
      if (data.fromUserId && currentUser && data.fromUserId === currentUser.id) return
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
      clearRingTimer()
      setCall((prev) => {
        if (!prev || prev.id !== data.callId || prev.direction !== 'outgoing') return prev
        return { ...prev, phase: 'connected', startedAt: Date.now() }
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

  // Seller inbox while logged in
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
    const current = callRef.current
    if (current && sessionRef.current) {
      void sendSignal(sessionRef.current, {
        type: 'end',
        callId: current.id,
        listingId: current.listingId,
        listingTitle: current.listingTitle,
        mode: current.mode,
        fromName: userRef.current?.name ?? 'Felhasználó',
        fromUserId: userRef.current?.id,
        ownerId: pendingInviteRef.current?.ownerId,
      })
    }

    pendingInviteRef.current = null
    cleanupMedia()
    void leaveSession()
    setCall((prev) => (prev ? { ...prev, phase: 'ended' } : null))
    window.setTimeout(() => setCall(null), 900)
  }, [cleanupMedia, clearRingTimer, leaveSession, sendSignal])

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

    setCall((prev) => (prev ? { ...prev, phase: 'connecting' } : prev))

    try {
      const stream = await getMediaStream(invite.mode)
      setLocalStream(stream)
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
  }, [sendSignal])

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
