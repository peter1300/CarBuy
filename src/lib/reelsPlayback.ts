/** Low-level helpers for TikTok-style muted autoplay. */

export function pauseVideo(video: HTMLVideoElement) {
  video.pause()
}

export function rewindVideo(video: HTMLVideoElement) {
  try {
    if (video.currentTime !== 0) video.currentTime = 0
  } catch {
    // ignore seek errors
  }
}

function seekToStart(video: HTMLVideoElement): Promise<void> {
  if (video.currentTime < 0.05) return Promise.resolve()

  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener('seeked', done)
      window.clearTimeout(timer)
      resolve()
    }
    const timer = window.setTimeout(done, 500)
    video.addEventListener('seeked', done)
    try {
      video.currentTime = 0
    } catch {
      done()
    }
  })
}

/**
 * Play a reel clip. Always attempts muted first (required for mobile autoplay),
 * then optionally unmutes if the user already enabled sound.
 *
 * Critical: if we seek to 0, we MUST wait for `seeked` before play().
 * Otherwise mobile browsers show the first frame and stay paused (AbortError).
 */
export async function playReelVideo(
  video: HTMLVideoElement,
  options: { fromStart?: boolean; allowSound?: boolean; signal?: { cancelled: boolean } },
): Promise<void> {
  const { fromStart = false, allowSound = false, signal } = options
  if (signal?.cancelled) return

  video.playsInline = true
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')
  video.defaultMuted = true
  video.muted = true
  video.volume = 1

  if (fromStart) {
    await seekToStart(video)
  }

  if (signal?.cancelled) return

  const tryPlay = async () => {
    if (signal?.cancelled) return
    await video.play()
  }

  try {
    await tryPlay()
  } catch {
    if (signal?.cancelled) return
    video.muted = true
    try {
      await tryPlay()
    } catch {
      return
    }
  }

  if (signal?.cancelled) return

  // Sound only after a successful muted play, and only if user asked for it.
  if (allowSound) {
    video.muted = false
  }
}
