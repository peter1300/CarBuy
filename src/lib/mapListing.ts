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

export function mapListingRow(row: ListingRow): Listing {
  return {
    id: row.id,
    title: row.title,
    make: row.make,
    model: row.model,
    year: row.year,
    price: Number(row.price),
    mileage: row.mileage,
    fuel: row.fuel,
    transmission: row.transmission,
    power: row.power,
    location: row.location,
    description: row.description,
    videoPoster: row.video_poster,
    videoDuration: row.video_duration,
    seller: {
      name: row.seller_name,
      type: row.seller_type,
      status: row.seller_status,
      rating: Number(row.seller_rating),
      responseTime: row.seller_response_time,
    },
    features: asStringArray(row.features),
    specs: asSpecs(row.specs),
    ownerId: row.owner_id ?? undefined,
    createdAt: row.created_at,
    uniqueViews: row.unique_views,
  }
}
