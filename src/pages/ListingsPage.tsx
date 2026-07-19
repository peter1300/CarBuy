import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ListingCard } from '../components/ListingCard'
import { SearchPanel } from '../components/SearchPanel'
import { useListings } from '../context/ListingsContext'
import { useLocale } from '../i18n/LocaleContext'
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
  const { t, locale } = useLocale()

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
            {t('listingsPage.searchPlaceholder')}
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
              placeholder={t('listingsPage.searchPlaceholder')}
              autoComplete="off"
            />
          </div>
          <button type="submit" className="btn btn--accent">
            {t('search.submit')}
          </button>
        </form>

        <div className="listings-layout">
          <aside className="listings-layout__sidebar" aria-label={t('listingsPage.filters')}>
            <SearchPanel
              variant="sidebar"
              initialFilters={filters}
              listingCount={filtered.length}
            />
          </aside>

          <section className="listings-layout__results" aria-live="polite">
            <header className="listings-results__header">
              <div>
                <h1>{t('listingsPage.title')}</h1>
                <p>
                  {loading
                    ? t('common.loading')
                    : filtered.length === 0
                      ? t('listingsPage.empty')
                      : t('listingsPage.count', {
                          count: filtered.length.toLocaleString(locale),
                        })}
                </p>
              </div>
            </header>

            {error && <p className="form-error">{error}</p>}

            {loading ? (
              <p className="state-message">{t('common.loading')}</p>
            ) : filtered.length > 0 ? (
              <div className="listings-grid listings-grid--results">
                {filtered.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <div className="profile-empty">
                <h3>{t('listingsPage.empty')}</h3>
                <p>{t('listingsPage.emptyHint')}</p>
                <Link to="/hirdetesek" className="btn btn--primary btn--lg">
                  {t('listingsPage.all')}
                </Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
