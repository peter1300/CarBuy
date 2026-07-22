import {
  captureVideoPoster,
  isAllowedListingVideo,
  MAX_LISTING_VIDEO_BYTES,
} from './listingVideo'
import type { CompressProgress } from './compressVideo'
import { isSupabaseConfigured, supabase } from './supabase'
import { tGlobal } from '../i18n/messages'

export type ListingVideoProgressPhase =
  | 'loading'
  | 'compressing_main'
  | 'compressing_flaws'
  | 'poster'
  | 'uploading'
  | 'saving'

export type ListingVideoProgress = {
  percent: number
  phase: ListingVideoProgressPhase
}

export type ProcessListingVideosInput = {
  listingId: string
  ownerId: string
  videoFile: File
  flawsVideoFile?: File | null
  onProgress?: (progress: ListingVideoProgress) => void
}

export type ProcessListingVideosResult = {
  videoUrl: string
  flawsVideoUrl: string | null
  posterUrl: string
  durationLabel: string
  /** Main video byte size after compression (what was uploaded). */
  videoSizeBytes: number
}

const BUCKET = 'listing-videos'
const UPLOAD_TIMEOUT_MS = 20 * 60 * 1000

/** Phase weights for overall percent (must sum to 100). */
const WEIGHTS = {
  loading: 5,
  compressing_main: 50,
  compressing_flaws: 15,
  poster: 5,
  uploading: 20,
  saving: 5,
} as const

function report(
  onProgress: ProcessListingVideosInput['onProgress'],
  completedBefore: number,
  phase: ListingVideoProgressPhase,
  phaseRatio: number,
  phaseWeight: number,
) {
  const ratio = Math.min(1, Math.max(0, phaseRatio))
  const percent = Math.min(99, Math.round(completedBefore + phaseWeight * ratio))
  onProgress?.({ percent, phase })
}

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

async function uploadWithProgress(
  path: string,
  body: Blob,
  contentType: string,
  onRatio?: (ratio: number) => void,
): Promise<void> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path, {
    upsert: true,
  })

  if (error || !data?.signedUrl) {
    // Fallback: SDK upload without byte-level progress
    const upload = supabase.storage.from(BUCKET).upload(path, body, {
      cacheControl: '3600',
      upsert: true,
      contentType,
    })
    const result = await withTimeout(upload, UPLOAD_TIMEOUT_MS, `Upload ${path}`)
    if (result.error) {
      throw new Error(result.error.message || tGlobal('errors.generic'))
    }
    onRatio?.(1)
    return
  }

  await withTimeout(
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', data.signedUrl)
      xhr.setRequestHeader('Content-Type', contentType)
      xhr.setRequestHeader('x-upsert', 'true')
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || event.total <= 0) return
        onRatio?.(Math.min(1, event.loaded / event.total))
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onRatio?.(1)
          resolve()
          return
        }
        reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`))
      }
      xhr.onerror = () => reject(new Error(tGlobal('errors.generic')))
      xhr.ontimeout = () => reject(new Error(`Upload ${path} timed out`))
      xhr.timeout = UPLOAD_TIMEOUT_MS
      xhr.send(body)
    }),
    UPLOAD_TIMEOUT_MS + 5_000,
    `Upload ${path}`,
  )
}

/**
 * Full listing video pipeline with phase-weighted progress (0–99 until caller saves).
 */
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

  const hasFlaws = Boolean(rawFlaws)
  const flawsWeight = hasFlaws ? WEIGHTS.compressing_flaws : 0
  // Redistribute unused flaws weight into main compress + upload
  const mainWeight = hasFlaws
    ? WEIGHTS.compressing_main
    : WEIGHTS.compressing_main + WEIGHTS.compressing_flaws * 0.6
  const uploadWeight = hasFlaws
    ? WEIGHTS.uploading
    : WEIGHTS.uploading + WEIGHTS.compressing_flaws * 0.4

  let completed = 0
  const onProgress = input.onProgress

  report(onProgress, completed, 'loading', 0, WEIGHTS.loading)

  const { compressTimeoutForSize, compressVideoForUpload } = await import('./compressVideo')

  const file = await compressVideoForUpload(rawFile, {
    timeoutMs: compressTimeoutForSize(rawFile.size),
    onProgress: (p: CompressProgress) => {
      if (p.phase === 'loading') {
        report(onProgress, completed, 'loading', Math.max(0.15, p.ratio), WEIGHTS.loading)
        return
      }
      // loading finished
      if (completed < WEIGHTS.loading) {
        completed = WEIGHTS.loading
      }
      report(onProgress, completed, 'compressing_main', p.ratio, mainWeight)
    },
  })
  completed = WEIGHTS.loading + mainWeight
  report(onProgress, completed, 'compressing_main', 1, 0)

  let flawsFile: File | null = null
  if (rawFlaws) {
    flawsFile = await compressVideoForUpload(rawFlaws, {
      timeoutMs: compressTimeoutForSize(rawFlaws.size),
      onProgress: (p: CompressProgress) => {
        if (p.phase === 'loading') {
          report(onProgress, completed, 'compressing_flaws', p.ratio * 0.05, flawsWeight)
          return
        }
        report(onProgress, completed, 'compressing_flaws', 0.05 + p.ratio * 0.95, flawsWeight)
      },
    })
    completed += flawsWeight
  }

  report(onProgress, completed, 'poster', 0.2, WEIGHTS.poster)
  const { blob: posterBlob, durationLabel } = await captureVideoPoster(file)
  completed += WEIGHTS.poster
  report(onProgress, completed, 'poster', 1, 0)

  const videoPath = `${input.ownerId}/${input.listingId}/video.mp4`
  const posterPath = `${input.ownerId}/${input.listingId}/poster.jpg`

  const uploadParts = flawsFile ? 3 : 2
  let uploadDone = 0
  const bumpUpload = (partRatio: number) => {
    const overall = (uploadDone + partRatio) / uploadParts
    report(onProgress, completed, 'uploading', overall, uploadWeight)
  }

  await uploadWithProgress(videoPath, file, 'video/mp4', (r) => bumpUpload(r))
  uploadDone += 1

  let flawsVideoUrl: string | null = null
  if (flawsFile) {
    const flawsPath = `${input.ownerId}/${input.listingId}/flaws.mp4`
    await uploadWithProgress(flawsPath, flawsFile, 'video/mp4', (r) => bumpUpload(r))
    uploadDone += 1
    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(flawsPath)
    flawsVideoUrl = publicUrl
  }

  await uploadWithProgress(posterPath, posterBlob, 'image/jpeg', (r) => bumpUpload(r))
  completed += uploadWeight
  report(onProgress, completed, 'uploading', 1, 0)

  report(onProgress, completed, 'saving', 0.5, WEIGHTS.saving)

  const {
    data: { publicUrl: videoUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(videoPath)
  const {
    data: { publicUrl: posterUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(posterPath)

  return {
    videoUrl,
    flawsVideoUrl,
    posterUrl,
    durationLabel,
    videoSizeBytes: file.size,
  }
}
