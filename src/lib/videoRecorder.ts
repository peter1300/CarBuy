/** Pick best supported mime + high quality bitrate for listing videos. */
export function pickRecorderOptions(): MediaRecorderOptions {
  const candidates = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]

  const mimeType = candidates.find((type) => {
    try {
      return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)
    } catch {
      return false
    }
  })

  return {
    ...(mimeType ? { mimeType } : {}),
    // ~8 Mbps → visibly better than browser file-input camera defaults
    videoBitsPerSecond: 8_000_000,
    audioBitsPerSecond: 128_000,
  }
}

export function recorderFileMeta(mimeType: string): { ext: string; type: string } {
  if (mimeType.includes('mp4')) return { ext: 'mp4', type: 'video/mp4' }
  if (mimeType.includes('webm')) return { ext: 'webm', type: 'video/webm' }
  return { ext: 'webm', type: mimeType || 'video/webm' }
}

export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
  },
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 },
  },
}

export function canUseInAppRecorder(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  )
}
