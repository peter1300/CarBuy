import { forwardRef, useEffect, useRef, type VideoHTMLAttributes } from 'react'
import { attachMediaSource } from '../lib/cloudflareStream'

type StreamVideoPlayerProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, 'src'> & {
  src?: string | null
}

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) return
  if (typeof ref === 'function') {
    ref(value)
    return
  }
  ;(ref as React.MutableRefObject<T | null>).current = value
}

/**
 * Plays MP4 or Cloudflare Stream HLS. Uses native HLS on Safari, hls.js elsewhere.
 */
export const StreamVideoPlayer = forwardRef<HTMLVideoElement, StreamVideoPlayerProps>(
  function StreamVideoPlayer({ src, ...props }, ref) {
    const innerRef = useRef<HTMLVideoElement | null>(null)

    useEffect(() => {
      const video = innerRef.current
      if (!video) return

      let cancelled = false
      let cleanup: (() => void) | undefined

      void attachMediaSource(video, src).then((fn) => {
        if (cancelled) {
          fn()
          return
        }
        cleanup = fn
      })

      return () => {
        cancelled = true
        cleanup?.()
      }
    }, [src])

    return (
      <video
        {...props}
        ref={(el) => {
          innerRef.current = el
          assignRef(ref, el)
        }}
      />
    )
  },
)
