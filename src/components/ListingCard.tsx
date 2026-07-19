import { Link } from 'react-router-dom'
import type { Listing } from '../data/listings'
import { formatListingTitle, formatMileage, formatPrice } from '../data/listings'
import { useLocale } from '../i18n/LocaleContext'
import { listingPath } from '../lib/listingUrl'
import { FavoriteButton } from './FavoriteButton'
import { StatusBadge } from './StatusBadge'

type Props = {
  listing: Listing
}

export function ListingCard({ listing }: Props) {
  const displayTitle = formatListingTitle(listing)
  const { locale, browseCountry } = useLocale()

  return (
    <Link to={listingPath(listing)} className="listing-card">
      <div className="listing-card__media">
        <img src={listing.videoPoster} alt={`${displayTitle}`} loading="lazy" />
        <FavoriteButton listing={listing} className="listing-card__fav" size="sm" />
        <div className="listing-card__play">
          <span className="play-btn" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M6.5 4.2v9.6L14.2 9 6.5 4.2z" fill="#111113" />
            </svg>
          </span>
        </div>
        <span className="listing-card__duration">{listing.videoDuration}</span>
      </div>
      <div className="listing-card__body">
        <div className="listing-card__top">
          <h3 className="listing-card__title">{displayTitle}</h3>
          <p className="listing-card__price">
            {formatPrice(listing.price, { locale, country: browseCountry })}
          </p>
        </div>
        <div className="listing-card__meta">
          <span>{listing.year}</span>
          <span>{formatMileage(listing.mileage)}</span>
          <span>{listing.fuel}</span>
          <span>{listing.transmission}</span>
        </div>
        <div className="listing-card__footer">
          <span className="listing-card__location">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M6 1.5C4.07 1.5 2.5 3.07 2.5 5c0 2.5 3.5 5.5 3.5 5.5S9.5 7.5 9.5 5C9.5 3.07 7.93 1.5 6 1.5zm0 4.75a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z"
                fill="currentColor"
              />
            </svg>
            {listing.location}
          </span>
          <StatusBadge status={listing.seller.status} />
        </div>
      </div>
    </Link>
  )
}
