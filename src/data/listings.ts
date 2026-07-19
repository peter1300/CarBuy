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
  /** ISO market country for this listing */
  country?: string
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

import type { AppLocale, MarketCountry } from '../i18n/locales'
import { COUNTRY_CURRENCY, LOCALE_BCP47 } from '../i18n/locales'

export function formatPrice(
  price: number,
  options?: { locale?: AppLocale; country?: MarketCountry },
): string {
  const locale = options?.locale ?? 'hu'
  const country = options?.country ?? 'HU'
  const currency = COUNTRY_CURRENCY[country]
  return new Intl.NumberFormat(LOCALE_BCP47[locale], {
    style: 'currency',
    currency,
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
