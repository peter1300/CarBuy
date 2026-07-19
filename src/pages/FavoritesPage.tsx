import { Link, Navigate } from 'react-router-dom'
import { ListingCard } from '../components/ListingCard'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'
import { useListings } from '../context/ListingsContext'

export function FavoritesPage() {
  const { user, loading: authLoading } = useAuth()
  const { favoriteIds, loading: favoritesLoading } = useFavorites()
  const { listings, loading: listingsLoading } = useListings()

  if (authLoading || favoritesLoading || listingsLoading) {
    return (
      <main className="page">
        <div className="container">
          <p className="state-message">Kedvencek betöltése…</p>
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
            <h1 className="section__title">Kedvencek</h1>
            <p className="section__sub">
              A mentett autók tanítják a Reels és a főoldali ajánlásokat is.
            </p>
          </div>
          <Link to="/reels" className="btn btn--accent">
            Reels
          </Link>
        </div>

        {favoriteListings.length === 0 ? (
          <div className="favorites-page__empty">
            <p>Még nincs kedvenced.</p>
            <p className="section__sub">
              Kattints a szív ikonra egy hirdetésen — utána hasonló autókat mutatunk a Reelsben.
            </p>
            <Link to="/hirdetesek" className="btn btn--primary">
              Hirdetések böngészése
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
