import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { formatMileage, formatPrice } from '../data/listings'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { useListings } from '../context/ListingsContext'
import { useCall } from '../context/CallContext'
import { useMessages } from '../context/MessagesContext'
import { listingIdFromSlug, listingPath } from '../lib/listingUrl'
import type { CallMode } from '../lib/callMedia'

export function ProductPage() {
  const { make, model, slug } = useParams<{ make: string; model: string; slug: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { getListing, recordUniqueView, loading: listingsLoading } = useListings()
  const { startCall, call } = useCall()
  const { openOrCreateConversation } = useMessages()
  const [messageBusy, setMessageBusy] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)

  const id = slug ? listingIdFromSlug(slug) : undefined
  const listing = id ? getListing(id) : undefined

  useEffect(() => {
    if (!id || !listing) return
    void recordUniqueView(id, { excludeUserId: user?.id })
  }, [id, listing?.id, recordUniqueView, user?.id])

  if (listingsLoading) {
    return (
      <main className="page product">
        <div className="container">
          <p className="state-message">Hirdetés betöltése…</p>
        </div>
      </main>
    )
  }

  if (!listing || !id) {
    return (
      <main className="page not-found">
        <div className="container">
          <h1>Hirdetés nem található</h1>
          <p>Ez az autó már nem elérhető, vagy hibás a link.</p>
          <Link to="/" className="btn btn--primary">
            Vissza a főoldalra
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

  const canCall = listing.seller.status === 'online' && !call
  const initials = listing.seller.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const hint =
    listing.seller.status === 'online'
      ? 'Az eladó elérhető — indíts hang- vagy videóhívást közvetlenül a platformon.'
      : listing.seller.status === 'busy'
        ? 'Az eladó jelenleg elfoglalt. Próbáld újra, amint Online státuszra vált.'
        : 'Az eladó Offline. Hívás csak Online státuszban indítható.'

  const handleCall = (mode: CallMode) => {
    if (listing.seller.status !== 'online') return
    if (!user) {
      navigate('/belepes', { state: { from: canonical } })
      return
    }
    void startCall({ listing, mode })
  }

  const handleMessage = async () => {
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
        <nav className="product-breadcrumb" aria-label="Morzsamenü">
          <Link to="/">Főoldal</Link>
          <span aria-hidden="true">/</span>
          <Link to="/szemelyauto">Személyautó</Link>
          <span aria-hidden="true">/</span>
          <Link to={`/szemelyauto/${make}`}>{listing.make}</Link>
          <span aria-hidden="true">/</span>
          <Link to={`/szemelyauto/${make}/${model}`}>{listing.model}</Link>
        </nav>

        <Link to="/hirdetesek" className="product__back">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Vissza a hirdetésekhez
        </Link>

        <div className="product__layout">
          <div className="product__main">
            <div className="product-video">
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
                  <img src={listing.videoPoster} alt={`${listing.title} videó`} />
                  <div className="product-video__overlay">
                    <span className="product-video__label">Videós bemutató</span>
                  </div>
                </>
              )}
              <span className="product-video__duration">{listing.videoDuration}</span>
            </div>

            <div className="product-info">
              <h1>{listing.title}</h1>
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
              <h2 id="specs-title">Műszaki adatok</h2>
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

            {listing.flawsVideoUrl && (
              <section className="flaws-panel" aria-labelledby="flaws-title">
                <h2 id="flaws-title">Őszinte pillantás a hibákra</h2>
                <p className="flaws-panel__lead">
                  Mindegyik használtautón vannak esztétikai hibák, ettől ne ijedj meg! Te most egy
                  őszinte eladót találtál.
                </p>
                <div className="flaws-panel__video">
                  <video
                    src={listing.flawsVideoUrl}
                    controls
                    playsInline
                    preload="metadata"
                  />
                </div>
              </section>
            )}
          </div>

          <aside className="product__aside">
            <div className="seller-card">
              <div className="seller-card__header">
                <div className="seller-card__avatar" aria-hidden="true">
                  {initials}
                </div>
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
                    {listing.seller.type === 'dealer' ? 'Kereskedő' : 'Magánszemély'}
                  </p>
                </div>
              </div>

              <div className="seller-card__stats">
                <div className="seller-stat">
                  <span>Értékelés</span>
                  <strong>{listing.seller.rating.toFixed(1)}</strong>
                </div>
                <div className="seller-stat">
                  <span>Válaszidő</span>
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
                  Videóhívás
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
                  Hanghívás
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--block"
                  disabled={messageBusy || Boolean(user && listing.ownerId === user.id) || !listing.ownerId}
                  onClick={() => void handleMessage()}
                >
                  {messageBusy ? 'Megnyitás…' : 'Üzenet küldése'}
                </button>
                {messageError && <p className="form-error">{messageError}</p>}
              </div>

              <p className={`seller-card__hint${canCall ? '' : ' seller-card__hint--warn'}`}>{hint}</p>
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
