import { Link } from 'react-router-dom'
import { ListingCard } from '../components/ListingCard'
import { SearchPanel } from '../components/SearchPanel'
import { useListings } from '../context/ListingsContext'

export function LandingPage() {
  const { listings, loading, error } = useListings()

  return (
    <main className="page">
      <section className="hero">
        <div className="hero__atmosphere" aria-hidden="true" />
        <div className="container">
          <div className="hero__content">
            <p className="hero__brand">CarBuy</p>
            <h1 className="hero__headline">Találd meg gyorsabban. Vedd meg biztosabban.</h1>
            <p className="hero__sub">
              Videós hirdetések és élő bemutató egy helyen — így percek alatt eldöntheted, hogy az autó
              valóban a tiéd.
            </p>
          </div>

          <SearchPanel />
        </div>
      </section>

      <section className="section" id="hirdetesek">
        <div className="container">
          <div className="section__header">
            <div>
              <h2 className="section__title">Friss videós hirdetések</h2>
              <p className="section__sub">Mozgásban látod az autót — nem csak állóképeken.</p>
            </div>
            <Link to="/szemelyauto" className="btn btn--outline">
              Összes hirdetés
            </Link>
          </div>

          {loading && <p className="state-message">Hirdetések betöltése…</p>}
          {error && !loading && <p className="form-error">{error}</p>}
          {!loading && !error && listings.length === 0 && (
            <p className="state-message">Még nincsenek hirdetések. Légy te az első!</p>
          )}
          {!loading && listings.length > 0 && (
            <div className="listings-grid">
              {listings.map((listing) => (
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
                  <path
                    d="M4 5.5A1.5 1.5 0 015.5 4h9A1.5 1.5 0 0116 5.5v6a1.5 1.5 0 01-1.5 1.5H11l-3 3v-3H5.5A1.5 1.5 0 014 11.5v-6z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <h3>Videós hirdetések</h3>
                <p>Beltér, karosszéria és menetdinamika — egyetlen görgetés alatt.</p>
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
