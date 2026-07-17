export type SellerStatus = 'online' | 'busy' | 'offline'

export type Listing = {
  id: string
  title: string
  make: string
  model: string
  year: number
  price: number
  mileage: number
  fuel: string
  transmission: string
  power: number
  location: string
  description: string
  videoPoster: string
  videoDuration: string
  /** Uploaded listing video (public URL); demos may omit */
  videoUrl?: string
  /** Optional honesty / flaws walkthrough video */
  flawsVideoUrl?: string
  seller: {
    name: string
    type: 'private' | 'dealer'
    status: SellerStatus
    rating: number
    responseTime: string
    avatarUrl?: string
  }
  features: string[]
  specs: { label: string; value: string }[]
  /** User-created listings only */
  ownerId?: string
  createdAt?: string
  uniqueViews?: number
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency: 'HUF',
    maximumFractionDigits: 0,
  }).format(price)
}

export function formatMileage(km: number): string {
  return `${new Intl.NumberFormat('hu-HU').format(km)} km`
}

/** Megjelenített cím: Márka + Modell + Hirdetés címe */
export function formatListingTitle(listing: {
  make: string
  model: string
  title: string
}): string {
  const make = listing.make.trim()
  const model = listing.model.trim()
  const title = listing.title.trim()
  const prefix = [make, model].filter((part) => part && part !== '—').join(' ')

  if (!prefix) return title || 'Hirdetés'
  if (!title || title === '—') return prefix

  const lowerTitle = title.toLowerCase()
  const lowerPrefix = prefix.toLowerCase()
  if (lowerTitle === lowerPrefix || lowerTitle.startsWith(`${lowerPrefix} `)) {
    return title
  }

  return `${prefix} ${title}`
}
