import { useEffect, useRef, useState } from 'react'
import { useCall } from '../context/CallContext'
import { useLocale } from '../i18n/LocaleContext'
import { formatCallDuration } from '../lib/callMedia'

export function CallOverlay() {
  const {
    call,
    localStream,
    remoteStream,
    endCall,
    acceptIncoming,
    rejectIncoming,
    toggleMute,
    toggleCamera,
  } = useCall()
  const { t } = useLocale()
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const el = localVideoRef.current
    if (!el) return
    el.srcObject = localStream
  }, [localStream, call?.phase])

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream
  }, [remoteStream, call?.phase])

  useEffect(() => {
    if (!call) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [call])

  useEffect(() => {
    if (call?.phase !== 'connected' || !call.startedAt) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [call?.phase, call?.startedAt])

  if (!call) return null

  const isIncoming = call.direction === 'incoming' && call.phase === 'ringing'
  const isVideo = call.mode === 'video'
  const showRemoteVideo =
    Boolean(remoteStream) &&
    isVideo &&
    call.phase === 'connected' &&
    remoteStream!.getVideoTracks().length > 0
  const liveDuration =
    call.phase === 'connected' && call.startedAt
      ? formatCallDuration(now - call.startedAt)
      : null

  const statusLabel =
    call.phase === 'requesting'
      ? t('call.connecting')
      : call.phase === 'ringing' && call.direction === 'outgoing'
        ? t('call.ringing')
        : call.phase === 'ringing' && call.direction === 'incoming'
          ? t('call.ringing')
          : call.phase === 'connecting'
            ? t('call.connecting')
            : call.phase === 'connected'
              ? t('call.inCall')
              : call.phase === 'failed'
                ? t('call.failed')
                : t('call.ended')

  return (
    <div className="call-overlay" role="dialog" aria-modal="true" aria-label={t('call.live')}>
      <div className="call-overlay__stage">
        <div className="call-overlay__remote">
          {showRemoteVideo ? (
            <video
              ref={remoteVideoRef}
              className="call-overlay__remote-media"
              autoPlay
              playsInline
            />
          ) : (
            <div className="call-overlay__avatar-wrap">
              <div className={`call-overlay__avatar${call.phase === 'ringing' ? ' is-ringing' : ''}`}>
                {call.remote.initials}
              </div>
            </div>
          )}
          {remoteStream && !isVideo && <audio ref={remoteAudioRef} autoPlay />}
          <div className="call-overlay__remote-shade" />
          {call.phase === 'connected' && remoteStream && (
            <div className="call-overlay__live-badge">{t('call.live')}</div>
          )}
        </div>

        {isVideo && localStream && call.phase !== 'failed' && (
          <div className={`call-overlay__local${call.cameraOff ? ' is-off' : ''}`}>
            <video ref={localVideoRef} autoPlay playsInline muted />
            {call.cameraOff && <span>{t('call.cameraOff')}</span>}
          </div>
        )}

        <div className="call-overlay__meta">
          <p className="call-overlay__listing">{call.listingTitle}</p>
          <h2 className="call-overlay__name">{call.remote.name}</h2>
          <p className="call-overlay__status">
            {call.error ?? statusLabel}
            {liveDuration && <span className="call-overlay__timer"> · {liveDuration}</span>}
          </p>
          <p className="call-overlay__mode">
            {isVideo ? t('product.videoCall') : t('product.voiceCall')}
          </p>
        </div>

        <div className="call-overlay__controls">
          {isIncoming ? (
            <>
              <button
                type="button"
                className="call-ctrl call-ctrl--reject"
                onClick={rejectIncoming}
                aria-label={t('call.reject')}
              >
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <path
                    d="M7 7l12 12M19 7L7 19"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
                <span>{t('call.reject')}</span>
              </button>
              <button
                type="button"
                className="call-ctrl call-ctrl--accept"
                onClick={() => void acceptIncoming()}
                aria-label={t('call.accept')}
              >
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <path
                    d="M8.2 5.5h3l1.4 4.5-1.8 1.2a11 11 0 005.8 5.8l1.2-1.8 4.5 1.4v3A1.6 1.6 0 0121 21 15 15 0 016.5 6.7a1.6 1.6 0 011.7-1.2z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>{t('call.accept')}</span>
              </button>
            </>
          ) : call.phase === 'failed' || call.phase === 'ended' ? (
            <button type="button" className="call-ctrl call-ctrl--end" onClick={endCall}>
              {t('call.close')}
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`call-ctrl${call.muted ? ' is-active' : ''}`}
                onClick={toggleMute}
                aria-label={call.muted ? t('reels.unmute') : t('reels.mute')}
              >
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <rect x="8" y="3" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.6" />
                  <path
                    d="M5.5 10.5a5.5 5.5 0 0011 0M11 16v3"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  {call.muted && (
                    <path d="M4 4l14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  )}
                </svg>
              </button>

              {isVideo && (
                <button
                  type="button"
                  className={`call-ctrl${call.cameraOff ? ' is-active' : ''}`}
                  onClick={toggleCamera}
                  aria-label={t('call.cameraOff')}
                >
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <rect x="3" y="6" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M14 10l5-3v8l-5-3v-2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                    {call.cameraOff && (
                      <path d="M3 3l16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    )}
                  </svg>
                </button>
              )}

              <button
                type="button"
                className="call-ctrl call-ctrl--end"
                onClick={endCall}
                aria-label={t('call.close')}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 10c4-3 10-3 14 0l-2 2.5c-1.2-.6-2.8-1-5-1s-3.8.4-5 1L5 10z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
