import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import type { Listing } from '../data/listings'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import {
  forgetFavorite,
  rememberFavorite,
  syncFavoriteIds,
} from '../lib/reels'

type FavoritesContextValue = {
  favoriteIds: Set<string>
  loading: boolean
  isFavorite: (listingId: string) => boolean
  toggleFavorite: (listing: Listing) => Promise<{ error?: string; requiresAuth?: boolean }>
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setFavoriteIds(new Set())
      syncFavoriteIds([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('favorites')
      .select('listing_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setFavoriteIds(new Set())
      setLoading(false)
      return
    }

    const ids = (data ?? []).map((row) => row.listing_id)
    setFavoriteIds(new Set(ids))
    syncFavoriteIds(ids)
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (authLoading) return
    void refresh()
  }, [authLoading, refresh])

  const isFavorite = useCallback(
    (listingId: string) => favoriteIds.has(listingId),
    [favoriteIds],
  )

  const toggleFavorite = useCallback(
    async (listing: Listing) => {
      if (!user) {
        return { requiresAuth: true }
      }
      if (!isSupabaseConfigured) {
        return { error: 'Supabase nincs beállítva.' }
      }

      const currentlyFavorite = favoriteIds.has(listing.id)

      if (currentlyFavorite) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('listing_id', listing.id)
        if (error) return { error: error.message }

        setFavoriteIds((prev) => {
          const next = new Set(prev)
          next.delete(listing.id)
          syncFavoriteIds([...next])
          return next
        })
        forgetFavorite(listing)
        return {}
      }

      const { error } = await supabase.from('favorites').insert({
        user_id: user.id,
        listing_id: listing.id,
      })
      if (error) return { error: error.message }

      setFavoriteIds((prev) => {
        const next = new Set(prev)
        next.add(listing.id)
        syncFavoriteIds([...next])
        return next
      })
      rememberFavorite(listing)
      return {}
    },
    [favoriteIds, user],
  )

  const value = useMemo(
    () => ({
      favoriteIds,
      loading,
      isFavorite,
      toggleFavorite,
    }),
    [favoriteIds, loading, isFavorite, toggleFavorite],
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider')
  return ctx
}
