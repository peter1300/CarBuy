import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ListingCard } from '../components/ListingCard'
import { SearchPanel } from '../components/SearchPanel'
import { useListings } from '../context/ListingsContext'
import {
  filterListings,
  listingSearchFromParams,
  listingSearchToQuery,
  sortListingsNewest,
} from '../lib/listingSearch'

export function ListingsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { listings, loading, error } = useListings()

  const filters = useMemo(() => listingSearchFromParams(searchParams), [searchParams])
  const [keyword, setKeyword] = useState(filters.q)

  useEffect(() => {
    setKeyword(filters.q)
  }, [filters.q])

  const filtered = useMemo(
    () => sortListingsNewest(filterListings(listings, filters)),
    [listings, filters],
  )

  const handleKeywordSubmit = (e: FormEvent) => {
    e.preventDefault()
    navigate(
      `/hirdetesek${listingSearchToQuery({
        ...filters,
        q: keyword.trim(),
      })}`,
    )
  }

  return (
    <main className="page listings-page">
      <div className="container listings-page__container">
        <form className="keyword-search" onSubmit={handleKeywordSubmit} role="search">
          <label className="sr-only" htmlFor="keyword-q">
            Szabadszavas keresés
          </label>
          <div className="keyword-search__field">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M13.2 13.2L17 17"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <input
              id="keyword-q"
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Szabadszavas keresés — márka, modell, leírás…"
              autoComplete="off"
            />
          </div>
          <button type="submit" className="btn btn--accent">
            Keresés
          </button>
        </form>

        <div className="listings-layout">
          <aside className="listings-layout__sidebar" aria-label="Részletes szűrők">
            <SearchPanel
              variant="sidebar"
              initialFilters={filters}
              listingCount={filtered.length}
            />
          </aside>

          <section className="listings-layout__results" aria-live="polite">
            <header className="listings-results__header">
              <div>
                <h1>Hirdetések</h1>
                <p>
                  {loading
                    ? 'Betöltés…'
                    : filtered.length === 0
                      ? 'Nincs megjeleníthető hirdetés a megadott feltételekkel.'
                      : `${filtered.length.toLocaleString('hu-HU')} videós hirdetés`}
                </p>
              </div>
            </header>

            {error && <p className="form-error">{error}</p>}

            {loading ? (
              <p className="state-message">Hirdetések betöltése…</p>
            ) : filtered.length > 0 ? (
              <div className="listings-grid listings-grid--results">
                {filtered.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <div className="profile-empty">
                <h3>Nincs találat</h3>
                <p>Próbálj tágabb szűrést, vagy töröld a szabadszavas keresést.</p>
                <Link to="/hirdetesek" className="btn btn--primary btn--lg">
                  Összes hirdetés
                </Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
