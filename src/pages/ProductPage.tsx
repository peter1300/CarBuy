import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { formatListingTitle, formatMileage, formatPrice } from '../data/listings'
import { FavoriteButton } from '../components/FavoriteButton'
import { StatusBadge } from '../components/StatusBadge'
import { UserAvatar } from '../components/UserAvatar'
import { useAuth } from '../context/AuthContext'
import { useListings } from '../context/ListingsContext'
import { useCall } from '../context/CallContext'
import { useMessages } from '../context/MessagesContext'
import { useLocale } from '../i18n/LocaleContext'
import { listingIdFromSlug, listingPath } from '../lib/listingUrl'
import { mapListingRow } from '../lib/mapListing'
import { rememberListingOpen } from '../lib/reels'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { CallMode } from '../lib/callMedia'
import type { Listing } from '../data/listings'

type SellerContact = {
  email: string
  phone: string | null
}

export function ProductPage() {
  const { make, model, slug } = useParams<{ make: string; model: string; slug: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { getListing, recordUniqueView, loading: listingsLoading } = useListings()
  const { startCall, call } = useCall()
  const { openOrCreateConversation } = useMessages()
  const { t } = useLocale()
  const [messageBusy, setMessageBusy] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)
  const [sellerContact, setSellerContact] = useState<SellerContact | null>(null)
  const [contactLoading, setContactLoading] = useState(false)
  const [detail, setDetail] = useState<Listing | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const id = slug ? listingIdFromSlug(slug) : undefined
  const summary = id ? getListing(id) : undefined
  const listing = detail ?? summary

  useEffect(() => {
    if (!id || !isSupabaseConfigured) {
      setDetail(null)
      setDetailLoading(false)
      return
    }

    let cancelled = false
    setDetailLoading(true)

    void (async () => {
      const { data } = await supabase.from('listings').select('*').eq('id', id).maybeSingle()
      if (cancelled) return
      setDetail(data ? mapListingRow(data) : null)
      setDetailLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!id || !listing) return
    void recordUniqueView(id, { excludeUserId: user?.id })
    rememberListingOpen(listing)
  }, [id, listing?.id, recordUniqueView, user?.id])

  useEffect(() => {
    if (!user || !listing?.ownerId || !isSupabaseConfigured) {
      setSellerContact(null)
      setContactLoading(false)
      return
    }

    let cancelled = false
    setContactLoading(true)

    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('email, phone')
        .eq('id', listing.ownerId!)
        .maybeSingle()

      if (cancelled) return
      if (error || !data) {
        setSellerContact(null)
      } else {
        setSellerContact({
          email: data.email,
          phone: data.phone,
        })
      }
      setContactLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [user, listing?.ownerId])

  if ((listingsLoading || detailLoading) && !listing) {
    return (
      <main className="page product">
        <div className="container">
          <p className="state-message">{t('product.loading')}</p>
        </div>
      </main>
    )
  }

  if (!listing || !id) {
    return (
      <main className="page not-found">
        <div className="container">
          <h1>{t('product.notFound')}</h1>
          <p>{t('product.notFoundText')}</p>
          <Link to="/" className="btn btn--primary">
            {t('product.home')}
          </Link>
        </div>
      </main>
    )
  }

  const canonical = listingPath(listing)
  const currentPath = `/szemelyauto/${make}/${model}/${slug}`
  if (currentPath !== canonical) {
    return <Navigate to={canonical} replace />
  }

  const isOwnListing = Boolean(user && listing.ownerId && listing.ownerId === user.id)
  const canCall = !isOwnListing && listing.seller.status === 'online' && !call
  const canMessage = !isOwnListing && Boolean(listing.ownerId) && !messageBusy
  const displayTitle = formatListingTitle(listing)

  const hint = isOwnListing
    ? t('product.hintOwn')
    : listing.seller.status === 'online'
      ? t('product.hintOnline')
      : listing.seller.status === 'busy'
        ? t('product.hintBusy')
        : t('product.hintOffline')

  const handleCall = (mode: CallMode) => {
    if (isOwnListing || listing.seller.status !== 'online') return
    if (!user) {
      navigate('/belepes', { state: { from: canonical } })
      return
    }
    void startCall({ listing, mode })
  }

  const handleMessage = async () => {
    if (isOwnListing) return
    if (!user) {
      navigate('/belepes', { state: { from: canonical } })
      return
    }
    if (messageBusy) return
    setMessageBusy(true)
    setMessageError(null)
    const result = await openOrCreateConversation(listing)
    setMessageBusy(false)
    if (result.error) {
      setMessageError(result.error)
      return
    }
    if (result.id) navigate(`/uzenetek/${result.id}`)
  }

  return (
    <main className="page product">
      <div className="container">
        <nav className="product-breadcrumb" aria-label={t('product.breadcrumb')}>
          <Link to="/">{t('product.homeCrumb')}</Link>
          <span aria-hidden="true">/</span>
          <Link to="/szemelyauto">{t('product.carsCrumb')}</Link>
          <span aria-hidden="true">/</span>
          <Link to={`/szemelyauto/${make}`}>{listing.make}</Link>
          <span aria-hidden="true">/</span>
          <Link to={`/szemelyauto/${make}/${model}`}>{listing.model}</Link>
        </nav>

        <Link to="/hirdetesek" className="product__back">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t('product.back')}
        </Link>

        <div className="product__layout">
          <div className="product__main">
            <div className="product-video">
              <FavoriteButton listing={listing} className="product-video__fav" />
              {listing.videoUrl ? (
                <video
                  className="product-video__player"
                  src={listing.videoUrl}
                  poster={listing.videoPoster}
                  controls
                  playsInline
                  preload="metadata"
                />
              ) : (
                <>
                  <img src={listing.videoPoster} alt={`${displayTitle}`} />
                  <div className="product-video__overlay">
                    <span className="product-video__label">{t('product.videoLabel')}</span>
                  </div>
                </>
              )}
              <span className="product-video__duration">{listing.videoDuration}</span>
            </div>

            <div className="product-info">
              <h1>{displayTitle}</h1>
              <p className="product-info__price">{formatPrice(listing.price)}</p>
              <div className="product-info__chips">
                <span className="chip">{listing.year}</span>
                <span className="chip">{formatMileage(listing.mileage)}</span>
                <span className="chip">{listing.fuel}</span>
                <span className="chip">{listing.transmission}</span>
                <span className="chip">{listing.power} LE</span>
                <span className="chip">{listing.location}</span>
              </div>
              <p className="product-info__desc">{listing.description}</p>
            </div>

            <section className="specs-panel" aria-labelledby="specs-title">
              <h2 id="specs-title">{t('product.specs')}</h2>
              <div className="specs-grid">
                {listing.specs.map((spec) => (
                  <div className="spec-item" key={spec.label}>
                    <span>{spec.label}</span>
                    <strong>{spec.value}</strong>
                  </div>
                ))}
              </div>
              <div className="features-list">
                {listing.features.map((feature) => (
                  <span className="feature-tag" key={feature}>
                    {feature}
                  </span>
                ))}
              </div>
            </section>

            <section className="flaws-panel" aria-labelledby="flaws-title">
              <h2 id="flaws-title">{t('product.flawsTitle')}</h2>
              {listing.flawsVideoUrl ? (
                <>
                  <p className="flaws-panel__lead">{t('product.flawsText')}</p>
                  <div className="flaws-panel__video">
                    <video
                      src={listing.flawsVideoUrl}
                      controls
                      playsInline
                      preload="metadata"
                    />
                  </div>
                </>
              ) : (
                <p className="flaws-panel__empty">{t('product.flawsNoVideo')}</p>
              )}
            </section>
          </div>

          <aside className="product__aside">
            <div className="seller-card">
              <div className="seller-card__header">
                <UserAvatar
                  name={listing.seller.name}
                  avatarUrl={listing.seller.avatarUrl}
                  className="seller-card__avatar"
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <p className="seller-card__name">{listing.seller.name}</p>
                    <StatusBadge status={listing.seller.status} />
                  </div>
                  <p className="seller-card__type">
                    {listing.seller.type === 'dealer' ? t('product.dealer') : t('product.private')}
                  </p>
                </div>
              </div>

              <div className="seller-card__stats">
                <div className="seller-stat">
                  <span>{t('product.rating')}</span>
                  <strong>{listing.seller.rating.toFixed(1)}</strong>
                </div>
                <div className="seller-stat">
                  <span>{t('product.responseTime')}</span>
                  <strong>{listing.seller.responseTime}</strong>
                </div>
              </div>

              <div className="seller-card__actions">
                <button
                  type="button"
                  className="btn btn--accent btn--lg btn--block"
                  disabled={!canCall}
                  onClick={() => handleCall('video')}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <rect x="3" y="4" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="9" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  {t('product.videoCall')}
                </button>
                <button
                  type="button"
                  className="btn btn--outline btn--lg btn--block"
                  disabled={!canCall}
                  onClick={() => handleCall('audio')}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path
                      d="M5.2 3.5h2.1l1 3.2-1.3.9a8.5 8.5 0 004.4 4.4l.9-1.3 3.2 1v2.1a1.2 1.2 0 01-1.3 1.2A11.5 11.5 0 014 4.8a1.2 1.2 0 011.2-1.3z"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {t('product.voiceCall')}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--block"
                  disabled={!canMessage}
                  onClick={() => void handleMessage()}
                >
                  {messageBusy ? t('product.messaging') : t('product.message')}
                </button>
                {messageError && <p className="form-error">{messageError}</p>}
              </div>

              <div className="seller-card__contact">
                <p className="seller-card__contact-label">{t('product.contact')}</p>
                {user ? (
                  contactLoading ? (
                    <p className="seller-card__contact-locked">{t('common.loading')}</p>
                  ) : sellerContact ? (
                    <ul className="seller-card__contact-list">
                      <li>
                        <span>{t('editProfile.email')}</span>
                        <a href={`mailto:${sellerContact.email}`}>{sellerContact.email}</a>
                      </li>
                      <li>
                        <span>{t('editProfile.phone')}</span>
                        {sellerContact.phone ? (
                          <a href={`tel:${sellerContact.phone.replace(/\s+/g, '')}`}>
                            {sellerContact.phone}
                          </a>
                        ) : (
                          <em>{t('product.phoneMissing')}</em>
                        )}
                      </li>
                    </ul>
                  ) : (
                    <p className="seller-card__contact-locked">
                      {t('product.phoneMissing')}
                    </p>
                  )
                ) : (
                  <p className="seller-card__contact-locked">
                    {t('product.loginForContact')}
                  </p>
                )}
              </div>

              <p className={`seller-card__hint${canCall || isOwnListing ? '' : ' seller-card__hint--warn'}`}>
                {hint}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}

/** Régi /auto/:id linkek átirányítása az új struktúrára */
export function LegacyListingRedirect() {
  const { id } = useParams<{ id: string }>()
  const { getListing } = useListings()
  const listing = id ? getListing(id) : undefined

  if (!listing) {
    return <Navigate to="/" replace />
  }

  return <Navigate to={listingPath(listing)} replace />
}
