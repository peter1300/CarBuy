import { Link, Navigate } from 'react-router-dom'
import { UserAvatar } from '../components/UserAvatar'
import { useAuth } from '../context/AuthContext'
import { useListings } from '../context/ListingsContext'
import { formatMileage, formatPrice } from '../data/listings'
import { listingPath } from '../lib/listingUrl'
import { StatusBadge } from '../components/StatusBadge'

export function ProfilePage() {
  const { user, loading: authLoading, logout } = useAuth()
  const { getListingsForUser, removeListing, loading: listingsLoading, error } = useListings()

  if (authLoading) {
    return (
      <main className="page profile-page">
        <div className="container">
          <p className="state-message">Profil betöltése…</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/belepes" replace />
  }

  const listings = getListingsForUser(user.id)
  const totalUniqueViews = listings.reduce((sum, l) => sum + (l.uniqueViews ?? 0), 0)
  const displayName =
    user.accountType === 'business' && user.companyName ? user.companyName : user.name

  return (
    <main className="page profile-page">
      <div className="profile-atmosphere" aria-hidden="true" />
      <div className="container">
        <header className="profile-header">
          <div className="profile-header__identity">
            <UserAvatar
              name={displayName}
              avatarUrl={user.avatarUrl}
              className="profile-header__avatar"
            />
            <div>
              <p className="profile-header__eyebrow">
                {user.accountType === 'business' ? 'Vállalkozói fiók' : 'Magánszemély'}
              </p>
              <h1 className="profile-header__name">{displayName}</h1>
              <p className="profile-header__email">{user.email}</p>
            </div>
          </div>
          <div className="profile-header__actions">
            <Link to="/hirdetes-feladas" className="btn btn--accent btn--lg">
              Új hirdetés
            </Link>
            <button type="button" className="btn btn--ghost btn--lg" onClick={() => void logout()}>
              Kilépés
            </button>
          </div>
        </header>

        <section className="profile-section" aria-labelledby="my-listings-title">
          <div className="profile-section__head">
            <div>
              <h2 id="my-listings-title">Saját hirdetéseim</h2>
              <p>
                {listingsLoading
                  ? 'Betöltés…'
                  : listings.length === 0
                    ? 'Még nincs feladott hirdetésed.'
                    : `${listings.length} aktív videós hirdetés`}
              </p>
            </div>
            <div className="profile-stat" aria-label="Egyedi megtekintések összesen">
              <span className="profile-stat__value">
                {totalUniqueViews.toLocaleString('hu-HU')}
              </span>
              <span className="profile-stat__label">Egyedi megtekintés</span>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          {listingsLoading ? (
            <p className="state-message">Hirdetések betöltése…</p>
          ) : listings.length === 0 ? (
            <div className="profile-empty">
              <h3>Itt jelennek meg a hirdetéseid</h3>
              <p>
                Amikor közzéteszel egy videós hirdetést, azonnal ebben a listában találod —
                innen szerkesztheted a státuszodat és megnyithatod a termékoldalt.
              </p>
              <Link to="/hirdetes-feladas" className="btn btn--primary btn--lg">
                Első hirdetés feladása
              </Link>
            </div>
          ) : (
            <ul className="profile-listings">
              {listings.map((listing) => (
                <li key={listing.id} className="profile-listing">
                  <Link to={listingPath(listing)} className="profile-listing__media">
                    <img src={listing.videoPoster} alt="" />
                    <span className="profile-listing__play" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M5.5 3.5v9L13 8 5.5 3.5z" fill="currentColor" />
                      </svg>
                    </span>
                  </Link>
                  <div className="profile-listing__body">
                    <div className="profile-listing__top">
                      <div>
                        <Link to={listingPath(listing)} className="profile-listing__title">
                          {listing.title}
                        </Link>
                        <p className="profile-listing__meta">
                          {listing.year} · {formatMileage(listing.mileage)} · {listing.fuel} ·{' '}
                          {listing.location}
                        </p>
                      </div>
                      <StatusBadge status={listing.seller.status} />
                    </div>
                    <div className="profile-listing__footer">
                      <div className="profile-listing__metrics">
                        <p className="profile-listing__price">{formatPrice(listing.price)}</p>
                        <p className="profile-listing__views">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                            <path
                              d="M1.5 7s2.2-3.5 5.5-3.5S12.5 7 12.5 7s-2.2 3.5-5.5 3.5S1.5 7 1.5 7z"
                              stroke="currentColor"
                              strokeWidth="1.2"
                            />
                            <circle cx="7" cy="7" r="1.6" stroke="currentColor" strokeWidth="1.2" />
                          </svg>
                          {(listing.uniqueViews ?? 0).toLocaleString('hu-HU')} egyedi megtekintés
                        </p>
                      </div>
                      <div className="profile-listing__actions">
                        <Link to={listingPath(listing)} className="btn btn--outline">
                          Megnyitás
                        </Link>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => void removeListing(listing.id)}
                        >
                          Törlés
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
