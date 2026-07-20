import type { Listing } from '../data/listings'
import type { ListingRow } from './database.types'
import type { Json } from './database.types'

type Spec = { label: string; value: string }

function asStringArray(value: Json): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function asSpecs(value: Json): Spec[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const row = item as { label?: unknown; value?: unknown }
    if (typeof row.label !== 'string' || typeof row.value !== 'string') return []
    return [{ label: row.label, value: row.value }]
  })
}

export function mapListingRow(row: Partial<ListingRow> & Pick<ListingRow, 'id'>): Listing {
  return {
    id: row.id,
    title: row.title ?? '',
    make: row.make ?? '',
    model: row.model ?? '',
    year: row.year ?? 0,
    price: Number(row.price ?? 0),
    mileage: row.mileage ?? 0,
    fuel: row.fuel ?? '',
    transmission: row.transmission ?? '',
    power: row.power ?? 0,
    location: row.location ?? '',
    description: row.description ?? '',
    country: row.country ?? undefined,
    videoPoster: row.video_poster ?? '',
    videoDuration: row.video_duration ?? '',
    videoUrl: row.video_url ?? undefined,
    flawsVideoUrl: row.flaws_video_url ?? undefined,
    seller: {
      name: row.seller_name ?? '',
      type: row.seller_type ?? 'private',
      status: row.seller_status ?? 'offline',
      rating: Number(row.seller_rating ?? 0),
      responseTime: row.seller_response_time ?? '',
      avatarUrl: row.seller_avatar_url ?? undefined,
    },
    features: row.features != null ? asStringArray(row.features) : [],
    specs: row.specs != null ? asSpecs(row.specs) : [],
    ownerId: row.owner_id ?? undefined,
    createdAt: row.created_at,
    uniqueViews: row.unique_views,
  }
}
