import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

export type CompressProgress = {
  phase: 'loading' | 'compressing'
  /** 0–1 while compressing */
  ratio: number
}

type CompressOptions = {
  onProgress?: (progress: CompressProgress) => void
  /** Soft target — if output is still huge we keep it; caller may still reject */
  maxHeight?: number
  /** Lower = better quality / larger file. 18–22 ≈ visually lossless for social. */
  crf?: number
  /** x264 preset — slower presets yield better quality at the same CRF. */
  preset?: 'fast' | 'medium' | 'slow' | 'veryfast'
  /** Audio bitrate for AAC track, e.g. 160k */
  audioBitrate?: string
  /** Abort compression and upload the original file when exceeded. */
  timeoutMs?: number
}

let ffmpegInstance: FFmpeg | null = null
let ffmpegLoad: Promise<FFmpeg> | null = null
let progressHandler: ((ratio: number) => void) | null = null

async function getFFmpeg(onProgress?: CompressOptions['onProgress']): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance

  if (!ffmpegLoad) {
    ffmpegLoad = (async () => {
      onProgress?.({ phase: 'loading', ratio: 0 })
      const ffmpeg = new FFmpeg()
      ffmpeg.on('progress', ({ progress }) => {
        const ratio = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0
        progressHandler?.(ratio)
      })
      // Single-thread core: no COOP/COEP / SharedArrayBuffer required
      const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm'
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      ffmpegInstance = ffmpeg
      return ffmpeg
    })().catch((err) => {
      ffmpegLoad = null
      throw err
    })
  }

  return ffmpegLoad
}

function extensionForInput(file: File): string {
  const name = file.name.toLowerCase()
  if (name.endsWith('.mov')) return 'mov'
  if (name.endsWith('.webm')) return 'webm'
  if (name.endsWith('.m4v')) return 'm4v'
  if (name.endsWith('.3gp') || name.endsWith('.3gpp')) return '3gp'
  if (file.type.includes('webm')) return 'webm'
  if (file.type.includes('quicktime')) return 'mov'
  return 'mp4'
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return promise
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out`))
    }, timeoutMs)
    promise
      .then((value) => {
        window.clearTimeout(timer)
        resolve(value)
      })
      .catch((err) => {
        window.clearTimeout(timer)
        reject(err)
      })
  })
}

/**
 * Re-encode to H.264/AAC MP4 at high visual quality (CRF ~18) and max 1080p.
 * Phone camera files often drop from 100MB+ to TikTok-like 10–40MB with minimal visible loss.
 * If compression fails or the result is larger, returns the original file.
 */
export async function compressVideoForUpload(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  const maxHeight = options.maxHeight ?? 1080
  const crf = options.crf ?? 18
  const preset = options.preset ?? 'fast'
  const audioBitrate = options.audioBitrate ?? '160k'

  // Tiny clips: still normalize to MP4 for consistent playback, unless already small mp4
  try {
    const compressPromise = (async () => {
      const ffmpeg = await getFFmpeg(options.onProgress)
      options.onProgress?.({ phase: 'compressing', ratio: 0 })
      progressHandler = (ratio) => options.onProgress?.({ phase: 'compressing', ratio })

      const inputName = `input.${extensionForInput(file)}`
      const outputName = 'output.mp4'

      await ffmpeg.writeFile(inputName, await fetchFile(file))

      // Scale down only if taller/wider than 1080 on the long edge height constraint
      const scaleFilter = `scale='min(${maxHeight},iw)':-2:force_original_aspect_ratio=decrease`

      await ffmpeg.exec([
        '-i',
        inputName,
        '-vf',
        scaleFilter,
        '-c:v',
        'libx264',
        '-preset',
        preset,
        '-crf',
        String(crf),
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        audioBitrate,
        '-ac',
        '2',
        '-movflags',
        '+faststart',
        '-y',
        outputName,
      ])

      const data = await ffmpeg.readFile(outputName)
      await ffmpeg.deleteFile(inputName).catch(() => undefined)
      await ffmpeg.deleteFile(outputName).catch(() => undefined)

      const bytes =
        typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
      const blob = new Blob([bytes], { type: 'video/mp4' })

      if (blob.size === 0) return file
      // Keep original if compression somehow grew the file
      if (blob.size >= file.size * 0.98) return file

      const base = file.name.replace(/\.[^.]+$/, '') || 'video'
      options.onProgress?.({ phase: 'compressing', ratio: 1 })
      return new File([blob], `${base}.mp4`, {
        type: 'video/mp4',
        lastModified: Date.now(),
      })
    })()

    return await withTimeout(compressPromise, options.timeoutMs ?? 0, 'Video compression')
  } catch (err) {
    console.warn('[CarBuy] video compression failed, uploading original', err)
    return file
  } finally {
    progressHandler = null
  }
}
