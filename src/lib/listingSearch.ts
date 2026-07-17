import type { Listing } from '../data/listings'

export type ListingSearchFilters = {
  q: string
  make: string
  model: string
  priceMin: string
  priceMax: string
  yearFrom: string
  yearTo: string
  powerMin: string
  powerMax: string
  mileageMin: string
  mileageMax: string
  fuel: string
  location: string
}

export const EMPTY_LISTING_SEARCH: ListingSearchFilters = {
  q: '',
  make: '',
  model: '',
  priceMin: '',
  priceMax: '',
  yearFrom: '',
  yearTo: '',
  powerMin: '',
  powerMax: '',
  mileageMin: '',
  mileageMax: '',
  fuel: '',
  location: '',
}

const PARAM_KEYS = Object.keys(EMPTY_LISTING_SEARCH) as (keyof ListingSearchFilters)[]

function parseNum(value: string): number | null {
  if (!value.trim()) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function listingSearchFromParams(params: URLSearchParams): ListingSearchFilters {
  const next = { ...EMPTY_LISTING_SEARCH }
  for (const key of PARAM_KEYS) {
    next[key] = params.get(key) ?? ''
  }
  if (next.fuel === 'Üzemanyag') next.fuel = ''
  return next
}

export function listingSearchToParams(filters: ListingSearchFilters): URLSearchParams {
  const params = new URLSearchParams()
  for (const key of PARAM_KEYS) {
    const value = filters[key].trim()
    if (!value) continue
    if (key === 'fuel' && value === 'Üzemanyag') continue
    if (key === 'location' && value === 'Teljes Magyarország') continue
    params.set(key, value)
  }
  return params
}

export function listingSearchToQuery(filters: ListingSearchFilters): string {
  const params = listingSearchToParams(filters)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function filterListings(listings: Listing[], filters: ListingSearchFilters): Listing[] {
  const q = filters.q.trim().toLowerCase()
  const priceMin = parseNum(filters.priceMin)
  const priceMax = parseNum(filters.priceMax)
  const yearFrom = parseNum(filters.yearFrom)
  const yearTo = parseNum(filters.yearTo)
  const powerMin = parseNum(filters.powerMin)
  const powerMax = parseNum(filters.powerMax)
  const mileageMin = parseNum(filters.mileageMin)
  const mileageMax = parseNum(filters.mileageMax)
  const fuel = filters.fuel.trim()
  const location = filters.location.trim()
  const make = filters.make.trim().toLowerCase()
  const model = filters.model.trim().toLowerCase()

  return listings.filter((listing) => {
    if (q) {
      const haystack = [
        listing.title,
        listing.make,
        listing.model,
        listing.description,
        listing.location,
        listing.fuel,
        listing.transmission,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }

    if (make && listing.make.toLowerCase() !== make) return false
    if (model && listing.model.toLowerCase() !== model) return false
    if (priceMin != null && listing.price < priceMin) return false
    if (priceMax != null && listing.price > priceMax) return false
    if (yearFrom != null && listing.year < yearFrom) return false
    if (yearTo != null && listing.year > yearTo) return false
    if (powerMin != null && listing.power < powerMin) return false
    if (powerMax != null && listing.power > powerMax) return false
    if (mileageMin != null && listing.mileage < mileageMin) return false
    if (mileageMax != null && listing.mileage > mileageMax) return false
    if (fuel && fuel !== 'Üzemanyag' && listing.fuel !== fuel) return false
    if (location && location !== 'Teljes Magyarország' && listing.location !== location) {
      return false
    }

    return true
  })
}

export function sortListingsNewest(listings: Listing[]): Listing[] {
  return [...listings].sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0
    return bTime - aTime
  })
}
