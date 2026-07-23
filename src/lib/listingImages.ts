import { tGlobal } from '../i18n/messages'
import { isSupabaseConfigured, supabase } from './supabase'

export const LISTING_IMAGES_BUCKET = 'listing-images'
export const MAX_LISTING_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_LISTING_IMAGES = 10
export const ALLOWED_LISTING_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const LISTING_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'

export function validateListingImageFile(file: File): string | null {
  if (!ALLOWED_LISTING_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_LISTING_IMAGE_TYPES)[number])) {
    return tGlobal('errors.listingImageType')
  }
  if (file.size > MAX_LISTING_IMAGE_BYTES) {
    return tGlobal('errors.listingImageSize')
  }
  return null
}

export function listingImageExtension(file: File): string {
  const type = file.type.toLowerCase()
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  const name = file.name.toLowerCase()
  if (name.endsWith('.png')) return 'png'
  if (name.endsWith('.webp')) return 'webp'
  return 'jpg'
}

/** Extract storage object path from a public listing-images URL. */
export function listingImagePathFromUrl(publicUrl: string): string | null {
  const marker = `/object/public/${LISTING_IMAGES_BUCKET}/`
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return null
  const path = publicUrl.slice(idx + marker.length).split('?')[0]
  return path ? decodeURIComponent(path) : null
}

export async function uploadListingImages(
  ownerId: string,
  listingId: string,
  files: File[],
): Promise<string[]> {
  if (!isSupabaseConfigured) {
    throw new Error(tGlobal('errors.supabaseMissing'))
  }
  if (files.length === 0) return []

  const urls: string[] = []
  for (const file of files) {
    const err = validateListingImageFile(file)
    if (err) throw new Error(err)
    const ext = listingImageExtension(file)
    const path = `${ownerId}/${listingId}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(LISTING_IMAGES_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || `image/${ext}`,
    })
    if (error) throw new Error(error.message || tGlobal('errors.generic'))
    const {
      data: { publicUrl },
    } = supabase.storage.from(LISTING_IMAGES_BUCKET).getPublicUrl(path)
    urls.push(publicUrl)
  }
  return urls
}

export async function deleteListingImagesByUrls(urls: string[]): Promise<void> {
  if (!isSupabaseConfigured || urls.length === 0) return
  const paths = urls
    .map(listingImagePathFromUrl)
    .filter((path): path is string => Boolean(path))
  if (paths.length === 0) return
  const { error } = await supabase.storage.from(LISTING_IMAGES_BUCKET).remove(paths)
  if (error) {
    console.warn('[CarBuy] listing image delete failed', error.message)
  }
}

/**
 * Keep existing URLs (order preserved), delete removed ones from storage,
 * upload new files, return final ordered URL list.
 */
export async function syncListingImages(input: {
  ownerId: string
  listingId: string
  previousUrls: string[]
  keepUrls: string[]
  newFiles: File[]
}): Promise<string[]> {
  const keep = input.keepUrls.filter(Boolean)
  const keepSet = new Set(keep)
  const removed = input.previousUrls.filter((url) => !keepSet.has(url))
  await deleteListingImagesByUrls(removed)

  if (keep.length + input.newFiles.length > MAX_LISTING_IMAGES) {
    throw new Error(tGlobal('errors.listingImageCount', { max: MAX_LISTING_IMAGES }))
  }

  const uploaded = await uploadListingImages(input.ownerId, input.listingId, input.newFiles)
  return [...keep, ...uploaded]
}
