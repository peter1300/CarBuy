export const MAX_LISTING_VIDEO_BYTES = 100 * 1024 * 1024
export const ALLOWED_LISTING_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const

export function formatVideoDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
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
      video.onerror = () => reject(new Error('A videó nem olvasható. Próbálj másik fájlt.'))
    })

    const duration = video.duration
    const seekTo = Number.isFinite(duration) ? Math.min(1, Math.max(0.1, duration * 0.08)) : 0.1
    video.currentTime = seekTo

    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve()
      video.onerror = () => reject(new Error('Nem sikerült előnézetet készíteni a videóból.'))
      window.setTimeout(() => resolve(), 2500)
    })

    const width = video.videoWidth || 1280
    const height = video.videoHeight || 720
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Előnézet készítése sikertelen.')
    ctx.drawImage(video, 0, 0, width, height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Előnézet mentése sikertelen.'))),
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
