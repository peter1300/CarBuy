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

export type CallInvitePayload = {
  type: 'invite' | 'accept' | 'reject' | 'end'
  callId: string
  listingId: string
  listingTitle: string
  mode: CallMode
  fromName: string
  ownerId?: string
}

export const CALL_CHANNEL = 'carbuy-calls-v1'

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
