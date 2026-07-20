import type { SellerStatus } from '../data/listings'
import { tGlobal } from '../i18n/messages'

export type ListingSpecsInput = {
  year: number
  mileage: number
  fuel: string
  transmission: string
  power: number
  location: string
}

export function buildListingSpecs(input: ListingSpecsInput) {
  return [
    { label: tGlobal('errors.specYear'), value: String(input.year) },
    {
      label: tGlobal('errors.specMileage'),
      value: `${input.mileage.toLocaleString()} km`,
    },
    { label: tGlobal('errors.specFuel'), value: input.fuel },
    { label: tGlobal('errors.specTransmission'), value: input.transmission },
    {
      label: tGlobal('errors.specPower'),
      value: input.power ? tGlobal('product.power', { power: input.power }) : '—',
    },
    { label: tGlobal('errors.specLocation'), value: input.location },
  ]
}

export type UserListingUpdateInput = {
  title: string
  year: number
  price: number
  mileage: number
  fuel: string
  transmission: string
  power: number
  location: string
  description: string
  status: SellerStatus
}
