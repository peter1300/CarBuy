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
  seller: {
    name: string
    type: 'private' | 'dealer'
    status: SellerStatus
    rating: number
    responseTime: string
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
