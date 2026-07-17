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
import { useAuth } from './AuthContext'
import {
  CALL_CHANNEL,
  getMediaStream,
  stopMediaStream,
  type ActiveCall,
  type CallInvitePayload,
  type CallMode,
  type CallParticipant,
} from '../lib/callMedia'
import type { Listing } from '../data/listings'

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

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [call, setCall] = useState<ActiveCall | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const ringTimerRef = useRef<number | null>(null)
  const pendingInviteRef = useRef<CallInvitePayload | null>(null)
  const callRef = useRef<ActiveCall | null>(null)
  const userRef = useRef(user)

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

  const broadcast = useCallback((payload: CallInvitePayload) => {
    try {
      channelRef.current?.postMessage(payload)
    } catch {
      // BroadcastChannel unavailable
    }
  }, [])

  const endCall = useCallback(() => {
    clearRingTimer()
    const current = callRef.current
    if (current) {
      broadcast({
        type: 'end',
        callId: current.id,
        listingId: current.listingId,
        listingTitle: current.listingTitle,
        mode: current.mode,
        fromName: userRef.current?.name ?? 'Felhasználó',
      })
    }
    pendingInviteRef.current = null
    cleanupMedia()
    setCall((prev) => (prev ? { ...prev, phase: 'ended' } : null))
    window.setTimeout(() => setCall(null), 900)
  }, [broadcast, cleanupMedia, clearRingTimer])

  const startCall = useCallback(
    async ({ listing, mode }: StartCallArgs) => {
      if (listing.seller.status !== 'online') {
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
          error: 'A hirdető jelenleg nem Online — hívás nem indítható.',
        })
        window.setTimeout(() => setCall(null), 2800)
        return
      }

      if (user && listing.ownerId && listing.ownerId === user.id) {
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
          error: 'Saját hirdetésedet nem hívhatod fel.',
        })
        window.setTimeout(() => setCall(null), 2800)
        return
      }

      clearRingTimer()
      cleanupMedia()

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
        setCall({
          id: callId,
          listingId: listing.id,
          listingTitle: listing.title,
          mode,
          phase: 'failed',
          direction: 'outgoing',
          remote: toParticipant(listing),
          muted: false,
          cameraOff: mode === 'audio',
          error: 'Kamera vagy mikrofon hozzáférés megtagadva. Engedélyezd a böngészőben.',
        })
        window.setTimeout(() => setCall(null), 3200)
        return
      }

      setCall((prev) => (prev ? { ...prev, phase: 'ringing' } : prev))

      broadcast({
        type: 'invite',
        callId,
        listingId: listing.id,
        listingTitle: listing.title,
        mode,
        fromName: user?.name ?? 'Érdeklődő',
        ownerId: listing.ownerId,
      })

      // Demo / ha nincs válasz: automatikus kapcsolódás
      ringTimerRef.current = window.setTimeout(() => {
        setCall((prev) => {
          if (!prev || prev.id !== callId || prev.phase !== 'ringing') return prev
          return {
            ...prev,
            phase: 'connected',
            startedAt: Date.now(),
          }
        })
      }, 2400)
    },
    [broadcast, cleanupMedia, clearRingTimer, user],
  )

  const acceptIncoming = useCallback(async () => {
    const invite = pendingInviteRef.current
    const current = callRef.current
    if (!invite || !current || current.direction !== 'incoming') return

    broadcast({
      type: 'accept',
      callId: invite.callId,
      listingId: invite.listingId,
      listingTitle: invite.listingTitle,
      mode: invite.mode,
      fromName: userRef.current?.name ?? 'Hirdető',
      ownerId: invite.ownerId,
    })

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
  }, [broadcast])

  const rejectIncoming = useCallback(() => {
    const invite = pendingInviteRef.current
    if (invite) {
      broadcast({
        type: 'reject',
        callId: invite.callId,
        listingId: invite.listingId,
        listingTitle: invite.listingTitle,
        mode: invite.mode,
        fromName: userRef.current?.name ?? 'Hirdető',
        ownerId: invite.ownerId,
      })
    }
    pendingInviteRef.current = null
    cleanupMedia()
    setCall(null)
  }, [broadcast, cleanupMedia])

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
    let channel: BroadcastChannel | null = null
    try {
      channel = new BroadcastChannel(CALL_CHANNEL)
      channelRef.current = channel
    } catch {
      return
    }

    channel.onmessage = (event: MessageEvent<CallInvitePayload>) => {
      const data = event.data
      if (!data?.type) return
      const currentUser = userRef.current
      const currentCall = callRef.current

      if (data.type === 'invite') {
        if (!currentUser || !data.ownerId || data.ownerId !== currentUser.id) return
        if (currentCall) return

        pendingInviteRef.current = data
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
          setCall((prev) => (prev ? { ...prev, phase: 'ended' } : null))
          window.setTimeout(() => setCall(null), 800)
        }
      }
    }

    return () => {
      channel?.close()
      channelRef.current = null
    }
  }, [cleanupMedia, clearRingTimer])

  useEffect(() => {
    return () => {
      clearRingTimer()
      cleanupMedia()
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
