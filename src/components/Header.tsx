import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LanguageSwitcher } from './LanguageSwitcher'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'
import { useMessages } from '../context/MessagesContext'
import { useLocale } from '../i18n/LocaleContext'

export function Header() {
  const { user, logout } = useAuth()
  const { favoriteIds } = useFavorites()
  const { unreadCount } = useMessages()
  const { t } = useLocale()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const displayName =
    user?.accountType === 'business' && user.companyName ? user.companyName : user?.name

  const badgeLabel = unreadCount > 99 ? '99+' : unreadCount > 0 ? String(unreadCount) : null
  const favoritesCount = favoriteIds.size
  const favoritesBadge =
    favoritesCount > 99 ? '99+' : favoritesCount > 0 ? String(favoritesCount) : null

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  useEffect(() => {
    if (!accountOpen) return

    const onPointerDown = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) {
        setAccountOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [accountOpen])

  const closeMenu = () => setMenuOpen(false)
  const closeAccount = () => setAccountOpen(false)

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="site-header__inner">
        <Link to="/" className="logo" aria-label="CarBuy">
          <span className="logo__mark" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M2 11h12l-1.2-4.2A1.5 1.5 0 0 0 11.35 5.5H4.65A1.5 1.5 0 0 0 3.2 6.8L2 11z"
                stroke="#fff"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              <circle cx="5" cy="12" r="1.3" fill="#2dd4a8" />
              <circle cx="11" cy="12" r="1.3" fill="#2dd4a8" />
            </svg>
          </span>
          CarBuy
        </Link>

        <nav className="nav-links" aria-label="Main">
          <Link to="/reels" className="nav-links__reels">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="1.5" y="1" width="8" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
              <path d="M11 4.5l1.5-1v7L11 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M4.2 4.8v4.4L7.8 7 4.2 4.8z" fill="currentColor" />
            </svg>
            {t('nav.reels')}
          </Link>
          <a href="/#kereses">{t('nav.search')}</a>
          <Link to="/hirdetesek">{t('nav.listings')}</Link>
          <Link to="/hirdetes-feladas">{t('nav.postListing')}</Link>
        </nav>

        <div className="header-actions">
          <LanguageSwitcher className="hide-mobile" />
          {user ? (
            <>
              <Link
                to="/kedvencek"
                className="header-mail header-fav"
                aria-label={t('nav.favorites')}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M10 17.25s-6.2-3.85-8.1-7.05C.4 7.7 1.15 4.6 3.85 3.55 5.55 2.9 7.45 3.35 10 5.4c2.55-2.05 4.45-2.5 6.15-1.85 2.7 1.05 3.45 4.15 1.95 6.65C16.2 13.4 10 17.25 10 17.25z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
                {favoritesBadge && <span className="header-mail__badge">{favoritesBadge}</span>}
              </Link>
              <Link to="/uzenetek" className="header-mail" aria-label={t('nav.messages')}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <rect
                    x="2.5"
                    y="4.5"
                    width="15"
                    height="11"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M3.5 6.5L10 11l6.5-4.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {badgeLabel && <span className="header-mail__badge">{badgeLabel}</span>}
              </Link>

              <div
                className={`account-menu hide-mobile${accountOpen ? ' is-open' : ''}`}
                ref={accountRef}
              >
                <button
                  type="button"
                  className="header-user"
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  aria-controls={menuId}
                  onClick={() => setAccountOpen((open) => !open)}
                >
                  <span className="header-user__name">{displayName}</span>
                  <svg
                    className="header-user__chevron"
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 4.5L6 7.5L9 4.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                {accountOpen && (
                  <div className="account-dropdown" id={menuId} role="menu">
                    <Link
                      to="/profil"
                      role="menuitem"
                      className="account-dropdown__item"
                      onClick={closeAccount}
                    >
                      {t('nav.myListings')}
                    </Link>
                    <Link
                      to="/profil/szerkesztes"
                      role="menuitem"
                      className="account-dropdown__item"
                      onClick={closeAccount}
                    >
                      {t('nav.editProfile')}
                    </Link>
                    <Link
                      to="/profil/beallitasok"
                      role="menuitem"
                      className="account-dropdown__item"
                      onClick={closeAccount}
                    >
                      {t('nav.settings')}
                    </Link>
                    <div className="account-dropdown__divider" role="separator" />
                    <button
                      type="button"
                      role="menuitem"
                      className="account-dropdown__item account-dropdown__item--danger"
                      onClick={() => {
                        closeAccount()
                        void logout()
                      }}
                    >
                      {t('nav.logout')}
                    </button>
                  </div>
                )}
              </div>
              <Link to="/hirdetes-feladas" className="btn btn--primary show-from-md">
                {t('nav.newListing')}
              </Link>
            </>
          ) : (
            <>
              <Link to="/belepes" className="btn btn--ghost show-from-md">
                {t('nav.login')}
              </Link>
              <Link to="/regisztracio" className="btn btn--primary show-from-md">
                {t('nav.register')}
              </Link>
            </>
          )}
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M3.5 6h13M3.5 10h13M3.5 14h13"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      <nav className={`mobile-nav${menuOpen ? ' is-open' : ''}`} aria-label="Mobile">
        {user && (
          <Link to="/profil" className="mobile-nav__my-listings" onClick={closeMenu}>
            {t('nav.myListings')}
          </Link>
        )}
        <div className="mobile-nav__lang">
          <LanguageSwitcher />
        </div>
        <Link to="/reels" className="mobile-nav__reels" onClick={closeMenu}>
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="1.5" y="1" width="8" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
            <path d="M11 4.5l1.5-1v7L11 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M4.2 4.8v4.4L7.8 7 4.2 4.8z" fill="currentColor" />
          </svg>
          {t('nav.reels')}
        </Link>
        <a href="/#kereses" onClick={closeMenu}>
          {t('nav.search')}
        </a>
        <Link to="/hirdetesek" onClick={closeMenu}>
          {t('nav.listings')}
        </Link>
        <Link to="/hirdetes-feladas" onClick={closeMenu}>
          {t('nav.postListing')}
        </Link>
        {user ? (
          <>
            <p className="mobile-nav__label">{displayName}</p>
            <Link to="/profil/szerkesztes" onClick={closeMenu}>
              {t('nav.editProfile')}
            </Link>
            <Link to="/profil/beallitasok" onClick={closeMenu}>
              {t('nav.settings')}
            </Link>
            <Link to="/kedvencek" onClick={closeMenu}>
              {t('nav.favorites')}
            </Link>
            <button
              type="button"
              className="btn btn--ghost"
              style={{ justifyContent: 'flex-start' }}
              onClick={() => {
                void logout()
                closeMenu()
              }}
            >
              {t('nav.logout')}
            </button>
          </>
        ) : (
          <>
            <Link to="/belepes" onClick={closeMenu}>
              {t('nav.login')}
            </Link>
            <Link to="/regisztracio" onClick={closeMenu}>
              {t('nav.register')}
            </Link>
          </>
        )}
      </nav>
    </header>
  )
}
