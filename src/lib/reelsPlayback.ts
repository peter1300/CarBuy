/** TikTok-style muted autoplay helpers for Reels. */

export function pauseVideo(video: HTMLVideoElement) {
  try {
    video.pause()
  } catch {
    // ignore
  }
}

export function rewindVideo(video: HTMLVideoElement) {
  try {
    if (video.currentTime > 0.01) video.currentTime = 0
  } catch {
    // ignore
  }
}

function waitForEvent(
  video: HTMLVideoElement,
  eventName: 'seeked' | 'canplay' | 'loadeddata',
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      video.removeEventListener(eventName, finish)
      window.clearTimeout(timer)
      resolve()
    }
    const timer = window.setTimeout(finish, timeoutMs)
    video.addEventListener(eventName, finish)
  })
}

async function ensureCanPlay(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return
  await Promise.race([
    waitForEvent(video, 'loadeddata', 4000),
    waitForEvent(video, 'canplay', 4000),
  ])
}

async function seekToStart(video: HTMLVideoElement): Promise<void> {
  if (video.currentTime < 0.05) return
  const seek = waitForEvent(video, 'seeked', 600)
  try {
    video.currentTime = 0
  } catch {
    return
  }
  await seek
}

export type PlayReelOptions = {
  /** Rewind to 0 before playing. Prefer false when already rewound on slide leave. */
  fromStart?: boolean
  allowSound?: boolean
  /** Return false if this play attempt was superseded. */
  isCurrent: () => boolean
}

/**
 * Play one reel. Always starts muted (mobile autoplay policy), then may unmute.
 *
 * Overlapping seek+play without guarding is what left videos stuck on the first frame.
 */
export async function playReelVideo(
  video: HTMLVideoElement,
  options: PlayReelOptions,
): Promise<boolean> {
  const { fromStart = false, allowSound = false, isCurrent } = options

  video.playsInline = true
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')
  video.defaultMuted = true
  video.muted = true
  video.volume = 1

  await ensureCanPlay(video)
  if (!isCurrent()) return false

  if (fromStart) {
    await seekToStart(video)
    if (!isCurrent()) return false
  }

  try {
    await video.play()
  } catch {
    if (!isCurrent()) return false
    video.muted = true
    try {
      await video.play()
    } catch {
      return false
    }
  }

  if (!isCurrent()) {
    pauseVideo(video)
    return false
  }

  if (allowSound) {
    video.muted = false
  }

  return !video.paused
}
