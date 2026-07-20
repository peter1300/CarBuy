import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLocale } from '../i18n/LocaleContext'

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M3.5 10.2L11 3.5l7.5 6.7V18a1.5 1.5 0 0 1-1.5 1.5h-3.5v-5h-5v5H5A1.5 1.5 0 0 1 3.5 18V10.2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ListingsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="16" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 9h8M7 13h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function ReelsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1.5" y="1" width="8" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11 4.5l1.5-1v7L11 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M4.2 4.8v4.4L7.8 7 4.2 4.8z" fill="currentColor" />
    </svg>
  )
}

function PostIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="8.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 7.5v7M7.5 11h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="11" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4.5 17.25c1.4-2.6 3.55-3.9 6.5-3.9s5.1 1.3 6.5 3.9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function MobileBottomNav() {
  const { user } = useAuth()
  const { t } = useLocale()
  const profileTo = user ? '/profil' : '/belepes'
  const profileLabel = user ? t('nav.profile') : t('nav.login')

  return (
    <nav className="mobile-bottom-nav" aria-label={t('nav.bottomAria')}>
      <NavLink to="/" end className={({ isActive }) => `mobile-bottom-nav__item${isActive ? ' is-active' : ''}`}>
        <HomeIcon />
        <span>{t('nav.home')}</span>
      </NavLink>

      <NavLink
        to="/hirdetesek"
        className={({ isActive }) => `mobile-bottom-nav__item${isActive ? ' is-active' : ''}`}
      >
        <ListingsIcon />
        <span>{t('nav.listings')}</span>
      </NavLink>

      <NavLink
        to="/reels"
        className={({ isActive }) =>
          `mobile-bottom-nav__item mobile-bottom-nav__item--reels${isActive ? ' is-active' : ''}`
        }
      >
        <span className="mobile-bottom-nav__reels-orb">
          <ReelsIcon />
        </span>
        <span>{t('nav.reels')}</span>
      </NavLink>

      <NavLink
        to="/hirdetes-feladas"
        className={({ isActive }) => `mobile-bottom-nav__item${isActive ? ' is-active' : ''}`}
      >
        <PostIcon />
        <span>{t('nav.newListingShort')}</span>
      </NavLink>

      <NavLink
        to={profileTo}
        className={({ isActive }) => `mobile-bottom-nav__item${isActive ? ' is-active' : ''}`}
      >
        <ProfileIcon />
        <span>{profileLabel}</span>
      </NavLink>
    </nav>
  )
}
