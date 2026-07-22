import { tGlobal } from '../i18n/messages'

export const MAX_LISTING_VIDEO_BYTES = 150 * 1024 * 1024

/** Preferált MIME-ek; mobilok gyakran üres type-ot vagy 3GPP-t adnak. */
export const ALLOWED_LISTING_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/3gpp',
  'video/3gpp2',
  'video/x-m4v',
] as const

const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.webm', '.m4v', '.3gp', '.3gpp'] as const

/** File picker: video/* → natív galéria/kamera, jobb minőség mobilon. */
export const LISTING_VIDEO_ACCEPT = 'video/*,.mp4,.mov,.webm,.m4v,.3gp'

export function formatVideoDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Human-readable uploaded video size for admin / diagnostics. */
export function formatVideoFileSizeMb(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0 || !Number.isFinite(bytes)) return '—'
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isAllowedListingVideo(file: File): boolean {
  const type = file.type.toLowerCase()
  if (type.startsWith('video/')) return true
  if (
    ALLOWED_LISTING_VIDEO_TYPES.includes(type as (typeof ALLOWED_LISTING_VIDEO_TYPES)[number])
  ) {
    return true
  }
  const name = file.name.toLowerCase()
  return ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))
}

export function listingVideoExtension(file: File): string {
  const type = file.type.toLowerCase()
  if (type === 'video/webm') return 'webm'
  if (type === 'video/quicktime') return 'mov'
  if (type === 'video/3gpp' || type === 'video/3gpp2') return '3gp'
  if (type === 'video/x-m4v') return 'm4v'
  const name = file.name.toLowerCase()
  const match = ALLOWED_EXTENSIONS.find((ext) => name.endsWith(ext))
  if (match) return match.slice(1)
  return 'mp4'
}

/** Capture a JPEG poster frame and duration from a local video file. */
export async function captureVideoPoster(file: File): Promise<{ blob: Blob; durationLabel: string }> {
  const objectUrl = URL.createObjectURL(file)

  try {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.src = objectUrl

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error(tGlobal('errors.videoUnreadable')))
    })

    const duration = video.duration
    const seekTo = Number.isFinite(duration) ? Math.min(1, Math.max(0.1, duration * 0.08)) : 0.1
    video.currentTime = seekTo

    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve()
      video.onerror = () => reject(new Error(tGlobal('errors.posterFrameFailed')))
      window.setTimeout(() => resolve(), 2500)
    })

    const width = video.videoWidth || 1280
    const height = video.videoHeight || 720
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error(tGlobal('errors.posterCreateFailed'))
    ctx.drawImage(video, 0, 0, width, height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error(tGlobal('errors.posterSaveFailed')))),
        'image/jpeg',
        0.85,
      )
    })

    return {
      blob,
      durationLabel: formatVideoDuration(duration),
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
