import { Link, useParams } from 'react-router-dom'
import { listings } from '../data/listings'
import { ListingCard } from '../components/ListingCard'
import { slugifySegment } from '../lib/listingUrl'

/** /szemelyauto, /szemelyauto/:make, /szemelyauto/:make/:model — szűrt listák */
export function CategoryPage() {
  const { make, model } = useParams<{ make?: string; model?: string }>()

  const filtered = listings.filter((listing) => {
    if (make && slugifySegment(listing.make) !== make) return false
    if (model && slugifySegment(listing.model) !== model) return false
    return true
  })

  const title = model
    ? filtered[0]
      ? `${filtered[0].make} ${filtered[0].model}`
      : `${make} / ${model}`
    : make
      ? filtered[0]?.make ?? make
      : 'Személyautó'

  return (
    <main className="page category-page">
      <div className="container">
        <nav className="product-breadcrumb" aria-label="Morzsamenü">
          <Link to="/">Főoldal</Link>
          <span aria-hidden="true">/</span>
          {make ? (
            <>
              <Link to="/szemelyauto">Személyautó</Link>
              <span aria-hidden="true">/</span>
              {model ? (
                <>
                  <Link to={`/szemelyauto/${make}`}>{filtered[0]?.make ?? make}</Link>
                  <span aria-hidden="true">/</span>
                  <span>{filtered[0]?.model ?? model}</span>
                </>
              ) : (
                <span>{filtered[0]?.make ?? make}</span>
              )}
            </>
          ) : (
            <span>Személyautó</span>
          )}
        </nav>

        <header className="category-page__header">
          <h1>{title}</h1>
          <p>
            {filtered.length === 0
              ? 'Nincs megjeleníthető hirdetés ebben a kategóriában.'
              : `${filtered.length} videós hirdetés`}
          </p>
        </header>

        {filtered.length > 0 ? (
          <div className="listings-grid">
            {filtered.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <div className="profile-empty">
            <h3>Nincs találat</h3>
            <p>Próbálj másik márkát, vagy nézd meg az összes személyautót.</p>
            <Link to="/szemelyauto" className="btn btn--primary btn--lg">
              Összes személyautó
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
