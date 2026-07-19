import { useEffect, useRef, useState } from 'react'
import {
  CAMERA_CONSTRAINTS,
  canUseInAppRecorder,
  pickRecorderOptions,
  recorderFileMeta,
} from '../lib/videoRecorder'
import { MAX_LISTING_VIDEO_BYTES } from '../lib/listingVideo'
import { useLocale } from '../i18n/LocaleContext'

type Props = {
  open: boolean
  title?: string
  onClose: () => void
  onRecorded: (file: File) => void
}

export function ListingVideoRecorder({
  open,
  title,
  onClose,
  onRecorded,
}: Props) {
  const { t } = useLocale()
  const resolvedTitle = title ?? t('recorder.start')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [stopping, setStopping] = useState(false)

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setError(null)
    setReady(false)
    setRecording(false)
    setStopping(false)
    setElapsed(0)
    chunksRef.current = []

    if (!canUseInAppRecorder()) {
      setError(t('recorder.errors'))
      return
    }

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => undefined)
        }
        setReady(true)
      } catch {
        if (!cancelled) {
          setError(t('recorder.errors'))
        }
      }
    })()

    return () => {
      cancelled = true
      clearTimer()
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop()
        } catch {
          /* ignore */
        }
      }
      recorderRef.current = null
      stopStream()
    }
  }, [open, t])

  const startRecording = () => {
    const stream = streamRef.current
    if (!stream || recording || stopping) return
    setError(null)
    chunksRef.current = []

    try {
      const options = pickRecorderOptions()
      const recorder = new MediaRecorder(stream, options)
      recorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onerror = () => {
        setError(t('recorder.errors'))
        setRecording(false)
        clearTimer()
      }

      recorder.start(1000)
      setRecording(true)
      setElapsed(0)
      clearTimer()
      timerRef.current = window.setInterval(() => {
        setElapsed((s) => s + 1)
      }, 1000)
    } catch {
      setError(t('recorder.errors'))
    }
  }

  const stopRecording = () => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive' || stopping) return
    setStopping(true)
    clearTimer()

    recorder.onstop = () => {
      const mime = recorder.mimeType || pickRecorderOptions().mimeType || 'video/webm'
      const { ext, type } = recorderFileMeta(mime)
      const blob = new Blob(chunksRef.current, { type })
      chunksRef.current = []
      recorderRef.current = null
      setRecording(false)
      setStopping(false)

      if (blob.size === 0) {
        setError(t('recorder.errors'))
        return
      }
      if (blob.size > MAX_LISTING_VIDEO_BYTES) {
        setError(t('create.videoSizeError'))
        return
      }

      const file = new File([blob], `carbuy-felvetel-${Date.now()}.${ext}`, { type })
      stopStream()
      onRecorded(file)
      onClose()
    }

    try {
      recorder.stop()
    } catch {
      setStopping(false)
      setRecording(false)
      setError(t('recorder.errors'))
    }
  }

  const handleClose = () => {
    clearTimer()
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop()
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null
    stopStream()
    onClose()
  }

  if (!open) return null

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <div className="video-recorder" role="dialog" aria-modal="true" aria-label={resolvedTitle}>
      <div className="video-recorder__panel">
        <header className="video-recorder__header">
          <h2>{resolvedTitle}</h2>
          <button type="button" className="btn btn--ghost" onClick={handleClose}>
            {t('recorder.close')}
          </button>
        </header>

        <div className="video-recorder__stage">
          <video ref={videoRef} className="video-recorder__preview" playsInline muted autoPlay />
          {recording && (
            <div className="video-recorder__badge" aria-live="polite">
              <span className="video-recorder__dot" />
              {mm}:{ss}
            </div>
          )}
        </div>

        <p className="video-recorder__note">{t('recorder.note')}</p>

        {error && <p className="form-error">{error}</p>}

        <div className="video-recorder__actions">
          {!recording ? (
            <button
              type="button"
              className="btn btn--accent btn--lg"
              disabled={!ready || Boolean(error && !ready)}
              onClick={startRecording}
            >
              {t('recorder.start')}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary btn--lg"
              disabled={stopping || elapsed < 1}
              onClick={stopRecording}
            >
              {stopping ? t('recorder.saving') : t('recorder.stop')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
