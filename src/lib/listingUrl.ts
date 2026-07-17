import type { Listing } from '../data/listings'
import { formatListingTitle } from '../data/listings'

/** Használtautó.hu-szerű kategória szegmens */
export const LISTING_CATEGORY = 'szemelyauto'

export type ListingUrlFields = Pick<Listing, 'id' | 'title' | 'make' | 'model'>

/** URL-szegmens: kisbetű, ékezet nélkül, aláhúzásokkal (pl. kia, model_3) */
export function slugifySegment(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

/**
 * Teljes hirdetés-útvonal:
 * /szemelyauto/kia/xceed/kia_xceed_1.6_t_gdi_...-23151041
 */
export function listingPath(listing: ListingUrlFields): string {
  const make = slugifySegment(listing.make) || 'egyeb'
  const model = slugifySegment(listing.model) || 'egyeb'
  const titleSlug = slugifySegment(formatListingTitle(listing)) || 'hirdetes'
  return `/${LISTING_CATEGORY}/${make}/${model}/${titleSlug}-${listing.id}`
}

/** A slug végéről olvassa ki a hirdetés-azonosítót (a cím slug aláhúzásos, az ID kötőjel után jön) */
export function listingIdFromSlug(slugWithId: string): string | undefined {
  const idx = slugWithId.lastIndexOf('-')
  if (idx === -1 || idx === slugWithId.length - 1) return undefined
  return slugWithId.slice(idx + 1)
}

/** Új hirdetéshez numerikus ID (Használtautó-stílus) */
export function createListingId(): string {
  const base = Date.now() % 100_000_000
  const noise = Math.floor(Math.random() * 90) + 10
  return `${base}${noise}`.slice(0, 10)
}
