import {
  isAllowedListingVideo,
  MAX_LISTING_VIDEO_BYTES,
  formatVideoDuration,
} from './listingVideo'
import {
  createStreamUpload,
  isStreamApiConfigured,
  isStreamEncodeComplete,
  uploadFileToStream,
  waitForStreamReady,
  type StreamStatusResponse,
} from './cloudflareStream'
import { isSupabaseConfigured } from './supabase'
import { tGlobal } from '../i18n/messages'

export type ListingVideoProgressPhase =
  | 'preparing'
  | 'uploading_main'
  | 'uploading_flaws'
  | 'encoding'
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
  /** Original main video byte size (Stream stores encoded size separately). */
  videoSizeBytes: number
  streamUid: string
  flawsStreamUid: string | null
}

/** Phase weights for overall percent (must sum to 100). */
const WEIGHTS = {
  preparing: 5,
  uploading_main: 45,
  uploading_flaws: 15,
  encoding: 30,
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

function encodingRatio(status: StreamStatusResponse): number {
  const pct = Number(status.pctComplete)
  if (Number.isFinite(pct) && pct >= 0) return Math.min(1, pct / 100)
  if (isStreamEncodeComplete(status)) return 1
  if (status.readyToStream || status.state === 'ready') return 0.85
  if (status.state === 'queued' || status.state === 'downloading' || status.state === 'pendingupload') {
    return 0.05
  }
  if (status.state === 'inprogress' || status.state === 'processing') return 0.45
  return 0.2
}

/**
 * Upload listing videos to Cloudflare Stream (no client FFmpeg).
 * Worker creates direct-upload URLs; encoding finishes via webhook or status poll.
 */
export async function processListingVideos(
  input: ProcessListingVideosInput,
): Promise<ProcessListingVideosResult> {
  if (!isSupabaseConfigured) {
    throw new Error(tGlobal('errors.supabaseMissing'))
  }
  if (!isStreamApiConfigured()) {
    throw new Error(
      'Missing VITE_STREAM_API_URL — set the Cloudflare Stream Worker URL in .env (see .env.example).',
    )
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
  const flawsUploadWeight = hasFlaws ? WEIGHTS.uploading_flaws : 0
  const mainUploadWeight = hasFlaws
    ? WEIGHTS.uploading_main
    : WEIGHTS.uploading_main + WEIGHTS.uploading_flaws * 0.7
  const encodingWeight = hasFlaws
    ? WEIGHTS.encoding
    : WEIGHTS.encoding + WEIGHTS.uploading_flaws * 0.3

  let completed = 0
  const onProgress = input.onProgress

  report(onProgress, completed, 'preparing', 0.5, WEIGHTS.preparing)
  completed = WEIGHTS.preparing
  report(onProgress, completed, 'preparing', 1, 0)

  const mainUpload = await createStreamUpload({
    listingId: input.listingId,
    kind: 'main',
    fileName: rawFile.name,
  })

  await uploadFileToStream(mainUpload.uploadURL, rawFile, (r) => {
    report(onProgress, completed, 'uploading_main', r, mainUploadWeight)
  })
  completed += mainUploadWeight

  let flawsUid: string | null = null
  if (rawFlaws) {
    const flawsUpload = await createStreamUpload({
      listingId: input.listingId,
      kind: 'flaws',
      fileName: rawFlaws.name,
    })
    flawsUid = flawsUpload.uid
    await uploadFileToStream(flawsUpload.uploadURL, rawFlaws, (r) => {
      report(onProgress, completed, 'uploading_flaws', r, flawsUploadWeight)
    })
    completed += flawsUploadWeight
  }

  report(onProgress, completed, 'encoding', 0.05, encodingWeight)

  const mainStatus = await waitForStreamReady(mainUpload.uid, {
    onProgress: (status) => {
      const mainRatio = encodingRatio(status)
      // If flaws exist, wait for both — show average-ish progress
      report(onProgress, completed, 'encoding', hasFlaws ? mainRatio * 0.7 : mainRatio, encodingWeight)
    },
  })

  let flawsStatus: StreamStatusResponse | null = null
  if (flawsUid) {
    flawsStatus = await waitForStreamReady(flawsUid, {
      onProgress: (status) => {
        const flawsRatio = encodingRatio(status)
        report(onProgress, completed, 'encoding', 0.7 + flawsRatio * 0.3, encodingWeight)
      },
    })
  }

  completed += encodingWeight
  report(onProgress, completed, 'saving', 0.5, WEIGHTS.saving)

  const hls = mainStatus.playback?.hls
  if (!hls) {
    throw new Error('Stream ready but HLS URL missing')
  }

  return {
    videoUrl: hls,
    flawsVideoUrl: flawsStatus?.playback?.hls ?? null,
    posterUrl: mainStatus.thumbnail || '',
    durationLabel: formatVideoDuration(Number(mainStatus.duration) || 0),
    videoSizeBytes: typeof mainStatus.size === 'number' ? mainStatus.size : rawFile.size,
    streamUid: mainUpload.uid,
    flawsStreamUid: flawsUid,
  }
}

/** Resume encoding poll when upload already completed (stream_uid set, no local file). */
export async function waitForExistingStreamListing(
  streamUid: string,
  onProgress?: (progress: ListingVideoProgress) => void,
): Promise<ProcessListingVideosResult> {
  report(onProgress, 60, 'encoding', 0.1, 35)
  const mainStatus = await waitForStreamReady(streamUid, {
    onProgress: (status) => {
      report(onProgress, 60, 'encoding', encodingRatio(status), 35)
    },
  })
  const hls = mainStatus.playback?.hls
  if (!hls) throw new Error('Stream ready but HLS URL missing')

  report(onProgress, 95, 'saving', 0.5, 5)
  return {
    videoUrl: hls,
    flawsVideoUrl: null,
    posterUrl: mainStatus.thumbnail || '',
    durationLabel: formatVideoDuration(Number(mainStatus.duration) || 0),
    videoSizeBytes: typeof mainStatus.size === 'number' ? mainStatus.size : 0,
    streamUid,
    flawsStreamUid: null,
  }
}
