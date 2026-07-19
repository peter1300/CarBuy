import type { MouseEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'
import type { Listing } from '../data/listings'

type Props = {
  listing: Listing
  className?: string
  size?: 'sm' | 'md'
}

export function FavoriteButton({ listing, className = '', size = 'md' }: Props) {
  const { user } = useAuth()
  const { isFavorite, toggleFavorite } = useFavorites()
  const navigate = useNavigate()
  const location = useLocation()
  const active = isFavorite(listing.id)

  const handleClick = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    if (!user) {
      const from = `${location.pathname}${location.search}${location.hash}`
      navigate('/belepes', { state: { from } })
      return
    }

    void toggleFavorite(listing)
  }

  return (
    <button
      type="button"
      className={`favorite-btn favorite-btn--${size}${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      aria-label={active ? 'Eltávolítás a kedvencekből' : 'Mentés a kedvencekbe'}
      aria-pressed={active}
      onClick={handleClick}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M10 17.25s-6.2-3.85-8.1-7.05C.4 7.7 1.15 4.6 3.85 3.55 5.55 2.9 7.45 3.35 10 5.4c2.55-2.05 4.45-2.5 6.15-1.85 2.7 1.05 3.45 4.15 1.95 6.65C16.2 13.4 10 17.25 10 17.25z"
          fill={active ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
