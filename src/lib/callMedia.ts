export type CallMode = 'video' | 'audio'

export type CallPhase =
  | 'idle'
  | 'requesting'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'ended'
  | 'failed'

export type CallParticipant = {
  name: string
  initials: string
  type: 'private' | 'dealer'
  avatarUrl?: string
}

export type ActiveCall = {
  id: string
  listingId: string
  listingTitle: string
  mode: CallMode
  phase: CallPhase
  direction: 'outgoing' | 'incoming'
  remote: CallParticipant
  startedAt?: number
  error?: string
  muted: boolean
  cameraOff: boolean
}

export type CallSignalPayload = {
  type: 'invite' | 'accept' | 'reject' | 'end' | 'offer' | 'answer' | 'ice'
  callId: string
  listingId: string
  listingTitle: string
  mode: CallMode
  fromName: string
  fromUserId?: string
  ownerId?: string
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

/** Inbox channel for a seller — they must be subscribed while logged in. */
export function callInboxChannel(userId: string) {
  return `call-inbox:${userId}`
}

/** Shared session channel for both parties of one call. */
export function callSessionChannel(callId: string) {
  return `call-session:${callId}`
}

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export async function getMediaStream(mode: CallMode): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video:
      mode === 'video'
        ? {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
        : false,
  })
}

export function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

export function formatCallDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
