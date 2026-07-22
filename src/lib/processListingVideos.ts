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

  const { compressVideoForUpload } = await import('./compressVideo')
  const file = await compressVideoForUpload(rawFile, { timeoutMs: 4 * 60 * 1000 })

  let flawsFile: File | null = null
  if (rawFlaws) {
    flawsFile = await compressVideoForUpload(rawFlaws, { timeoutMs: 4 * 60 * 1000 })
  }

  const { blob: posterBlob, durationLabel } = await captureVideoPoster(file)

  const videoPath = `${input.ownerId}/${input.listingId}/video.mp4`
  const posterPath = `${input.ownerId}/${input.listingId}/poster.jpg`

  const { error: videoUploadError } = await supabase.storage
    .from('listing-videos')
    .upload(videoPath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: 'video/mp4',
    })
  if (videoUploadError) {
    throw new Error(videoUploadError.message || tGlobal('errors.generic'))
  }

  let flawsVideoUrl: string | null = null
  if (flawsFile) {
    const flawsPath = `${input.ownerId}/${input.listingId}/flaws.mp4`
    const { error: flawsUploadError } = await supabase.storage
      .from('listing-videos')
      .upload(flawsPath, flawsFile, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'video/mp4',
      })
    if (flawsUploadError) {
      throw new Error(flawsUploadError.message || tGlobal('errors.generic'))
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from('listing-videos').getPublicUrl(flawsPath)
    flawsVideoUrl = publicUrl
  }

  const { error: posterUploadError } = await supabase.storage
    .from('listing-videos')
    .upload(posterPath, posterBlob, {
      cacheControl: '3600',
      upsert: true,
      contentType: 'image/jpeg',
    })
  if (posterUploadError) {
    throw new Error(posterUploadError.message || tGlobal('errors.generic'))
  }

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
}
