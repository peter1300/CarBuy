import { Link, Navigate } from 'react-router-dom'
import { ListingCard } from '../components/ListingCard'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'
import { useListings } from '../context/ListingsContext'
import { useLocale } from '../i18n/LocaleContext'

export function FavoritesPage() {
  const { user, loading: authLoading } = useAuth()
  const { favoriteIds, loading: favoritesLoading } = useFavorites()
  const { listings, loading: listingsLoading } = useListings()
  const { t } = useLocale()

  if (authLoading || favoritesLoading || listingsLoading) {
    return (
      <main className="page">
        <div className="container">
          <p className="state-message">{t('favorites.loading')}</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/belepes" replace state={{ from: '/kedvencek' }} />
  }

  const favoriteListings = listings.filter((l) => favoriteIds.has(l.id))

  return (
    <main className="page favorites-page">
      <div className="container">
        <div className="section__header favorites-page__header">
          <div>
            <h1 className="section__title">{t('favorites.title')}</h1>
            <p className="section__sub">{t('favorites.sub')}</p>
          </div>
          <Link to="/reels" className="btn btn--accent">
            {t('nav.reels')}
          </Link>
        </div>

        {favoriteListings.length === 0 ? (
          <div className="favorites-page__empty">
            <p>{t('favorites.empty')}</p>
            <p className="section__sub">{t('favorites.emptyHint')}</p>
            <Link to="/hirdetesek" className="btn btn--primary">
              {t('favorites.browse')}
            </Link>
          </div>
        ) : (
          <div className="listings-grid">
            {favoriteListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
