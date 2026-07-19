import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ListingCard } from '../components/ListingCard'
import { SearchPanel } from '../components/SearchPanel'
import { useListings } from '../context/ListingsContext'
import { formatListingTitle, formatPrice } from '../data/listings'

const HOME_LISTINGS_LIMIT = 8
const REELS_PREVIEW_LIMIT = 8

export function LandingPage() {
  const { listings, loading, error } = useListings()

  const newestListings = useMemo(
    () =>
      [...listings]
        .sort((a, b) => {
          const aTime = a.createdAt ? Date.parse(a.createdAt) : 0
          const bTime = b.createdAt ? Date.parse(b.createdAt) : 0
          return bTime - aTime
        })
        .slice(0, HOME_LISTINGS_LIMIT),
    [listings],
  )

  const reelsPreview = useMemo(
    () =>
      listings
        .filter((l) => Boolean(l.videoUrl || l.videoPoster))
        .slice(0, REELS_PREVIEW_LIMIT),
    [listings],
  )

  return (
    <main className="page">
      <section className="hero">
        <div className="hero__atmosphere" aria-hidden="true" />
        <div className="container">
          <div className="hero__content">
            <p className="hero__brand">CarBuy</p>
            <h1 className="hero__headline">Találd meg gyorsabban. Vedd meg biztosabban.</h1>
            <p className="hero__sub">
              Videós hirdetések és élő bemutató, így percek alatt eldöntheted, hogy az autó valóban a
              tiéd lesz-e
            </p>
          </div>

          <SearchPanel listingCount={listings.length} />
        </div>
      </section>

      <section className="reels-promo" aria-labelledby="reels-promo-title">
        <div className="reels-promo__atmosphere" aria-hidden="true" />
        <div className="container reels-promo__inner">
          <div className="reels-promo__copy">
            <p className="reels-promo__eyebrow">Új</p>
            <h2 id="reels-promo-title">Reels — autók végiggörgetve</h2>
            <p>
              Függőleges videófolyam: nézd meg az autókat mozgásban, egy kézmozdulattal a következőig.
            </p>
            <Link to="/reels" className="btn btn--accent btn--lg reels-promo__cta">
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M4.2 2.8v8.4L11.2 7 4.2 2.8z" fill="currentColor" />
              </svg>
              Reels indítása
            </Link>
          </div>

          <div className="reels-promo__stage">
            {reelsPreview.length > 0 ? (
              <div className="reels-promo__strip" aria-hidden="true">
                {reelsPreview.map((listing, index) => (
                  <Link
                    key={listing.id}
                    to="/reels"
                    className="reels-promo__card"
                    style={{ animationDelay: `${0.08 * index}s` }}
                    tabIndex={-1}
                  >
                    <img src={listing.videoPoster} alt="" loading="lazy" />
                    <span className="reels-promo__card-play">
                      <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                        <path d="M6.5 4.2v9.6L14.2 9 6.5 4.2z" fill="#fff" />
                      </svg>
                    </span>
                    <span className="reels-promo__card-meta">
                      <strong>{formatListingTitle(listing)}</strong>
                      <em>{formatPrice(listing.price)}</em>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="reels-promo__placeholder" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section" id="hirdetesek">
        <div className="container">
          <div className="section__header">
            <div>
              <h2 className="section__title">Friss videós hirdetések</h2>
              <p className="section__sub">Mozgásban látod az autót — nem csak állóképeken.</p>
            </div>
            <div className="section__header-actions">
              <Link to="/reels" className="btn btn--accent">
                Reels
              </Link>
              <Link to="/hirdetesek" className="btn btn--outline">
                Összes hirdetés
              </Link>
            </div>
          </div>

          {loading && <p className="state-message">Hirdetések betöltése…</p>}
          {error && !loading && <p className="form-error">{error}</p>}
          {!loading && !error && newestListings.length === 0 && (
            <p className="state-message">Még nincsenek hirdetések. Légy te az első!</p>
          )}
          {!loading && newestListings.length > 0 && (
            <div className="listings-grid">
              {newestListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="why">
        <div className="container why__inner">
          <div className="why__copy">
            <h2>Kevesebb várakozás. Több bizonyosság.</h2>
            <p>
              A CarBuy nem fotógalériát ad — rövid videót és azonnali hang- vagy videóhívást az
              eladóval, ha online van. Így a keresés és az eladás is felgyorsul.
            </p>
          </div>
          <div className="why__points">
            <article className="why-point">
              <div className="why-point__icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="5" y="2.5" width="8" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8.2 7.2v5.6L12.5 10 8.2 7.2z" fill="currentColor" />
                </svg>
              </div>
              <div>
                <h3>Reels folyam</h3>
                <p>Görgesd végig a kínálatot videóban — mint a közösségi feed, autókra szabva.</p>
              </div>
            </article>
            <article className="why-point">
              <div className="why-point__icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M10 6.5v4l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h3>Percnyi döntés</h3>
                <p>Szűrj, nézz videót, hívd fel az eladót — ha Online, azonnal.</p>
              </div>
            </article>
            <article className="why-point">
              <div className="why-point__icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M7 4.5h6v3.2c0 1.4-.8 2.3-2 2.9v1.4h-2v-1.4c-1.2-.6-2-1.5-2-2.9V4.5z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path d="M5.5 16.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h3>Biztonságos élő hívás</h3>
                <p>Hang- és videóhívás csak Online státuszban — kontrollált, platformon belül.</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="cta-band" id="regisztracio">
        <div className="container cta-band__inner">
          <div className="cta-band__copy">
            <p className="cta-band__eyebrow">Eladóknak</p>
            <h2>Az autó eladása nem várakozás — bemutató.</h2>
            <p>
              Regisztrálj magánként vagy cégként. Az első videós hirdetésed ingyenes. Amikor Online
              vagy, az érdeklődő egy kattintással hív.
            </p>
          </div>
          <div className="cta-band__actions">
            <Link to="/regisztracio" className="btn btn--accent btn--lg">
              Fiók létrehozása
            </Link>
            <Link to="/hirdetes-feladas" className="btn btn--outline btn--lg cta-band__ghost">
              Hirdetésfeladás
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
