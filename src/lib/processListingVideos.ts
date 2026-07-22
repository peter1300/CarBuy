import { captureVideoPoster, isAllowedListingVideo, MAX_LISTING_VIDEO_BYTES } from './listingVideo'
import { isSupabaseConfigured, supabase } from './supabase'
import { tGlobal } from '../i18n/messages'

export type ProcessListingVideosInput = {
  listingId: string
  ownerId: string
  videoFile: File
  flawsVideoFile?: File | null
}

export type ProcessListingVideosResult = {
  videoUrl: string
  flawsVideoUrl: string | null
  posterUrl: string
  durationLabel: string
  /** Main video byte size after compression (what was uploaded). */
  videoSizeBytes: number
}

/** Storage upload of large originals (e.g. 180 MB) must not hang forever. */
const UPLOAD_TIMEOUT_MS = 12 * 60 * 1000
/** Soft overall budget for the whole pipeline (compress + upload + poster). */
const PROCESS_TIMEOUT_MS = 15 * 60 * 1000

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
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

async function uploadListingFile(
  path: string,
  body: Blob,
  contentType: string,
): Promise<void> {
  const upload = supabase.storage.from('listing-videos').upload(path, body, {
    cacheControl: '3600',
    upsert: true,
    contentType,
  })

  const { error } = await withTimeout(upload, UPLOAD_TIMEOUT_MS, `Upload ${path}`)
  if (error) {
    throw new Error(error.message || tGlobal('errors.generic'))
  }
}

export async function processListingVideos(
  input: ProcessListingVideosInput,
): Promise<ProcessListingVideosResult> {
  if (!isSupabaseConfigured) {
    throw new Error(tGlobal('errors.supabaseMissing'))
  }

  const rawFile = input.videoFile
  if (!isAllowedListingVideo(rawFile)) {
    throw new Error(tGlobal('create.videoTypeError'))
  }
  if (rawFile.size > MAX_LISTING_VIDEO_BYTES) {
    throw new Error(tGlobal('create.videoSizeError'))
  }

  const rawFlaws = input.flawsVideoFile ?? null
  if (rawFlaws) {
    if (!isAllowedListingVideo(rawFlaws)) {
      throw new Error(tGlobal('create.videoTypeError'))
    }
    if (rawFlaws.size > MAX_LISTING_VIDEO_BYTES) {
      throw new Error(tGlobal('create.videoSizeError'))
    }
  }

  const pipeline = (async (): Promise<ProcessListingVideosResult> => {
    const { compressVideoForUpload } = await import('./compressVideo')
    // Large files skip WASM re-encode; smaller ones get a few minutes of compress time.
    const file = await compressVideoForUpload(rawFile, { timeoutMs: 3 * 60 * 1000 })

    let flawsFile: File | null = null
    if (rawFlaws) {
      flawsFile = await compressVideoForUpload(rawFlaws, { timeoutMs: 3 * 60 * 1000 })
    }

    const { blob: posterBlob, durationLabel } = await captureVideoPoster(file)

    const videoPath = `${input.ownerId}/${input.listingId}/video.mp4`
    const posterPath = `${input.ownerId}/${input.listingId}/poster.jpg`

    await uploadListingFile(videoPath, file, 'video/mp4')

    let flawsVideoUrl: string | null = null
    if (flawsFile) {
      const flawsPath = `${input.ownerId}/${input.listingId}/flaws.mp4`
      await uploadListingFile(flawsPath, flawsFile, 'video/mp4')
      const {
        data: { publicUrl },
      } = supabase.storage.from('listing-videos').getPublicUrl(flawsPath)
      flawsVideoUrl = publicUrl
    }

    await uploadListingFile(posterPath, posterBlob, 'image/jpeg')

    const {
      data: { publicUrl: videoUrl },
    } = supabase.storage.from('listing-videos').getPublicUrl(videoPath)
    const {
      data: { publicUrl: posterUrl },
    } = supabase.storage.from('listing-videos').getPublicUrl(posterPath)

    return {
      videoUrl,
      flawsVideoUrl,
      posterUrl,
      durationLabel,
      videoSizeBytes: file.size,
    }
  })()

  return withTimeout(pipeline, PROCESS_TIMEOUT_MS, 'Listing video processing')
}
