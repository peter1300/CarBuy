import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Listing, SellerStatus } from '../data/listings'
import type { User } from './AuthContext'
import { createListingId } from '../lib/listingUrl'
import { mapListingRow } from '../lib/mapListing'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export type UserListingInput = {
  title: string
  make: string
  model: string
  year: number
  price: number
  mileage: number
  fuel: string
  transmission: string
  power: number
  location: string
  description: string
  videoName: string
  status: SellerStatus
}

type ListingsContextValue = {
  listings: Listing[]
  loading: boolean
  error: string | null
  refreshListings: () => Promise<void>
  addListing: (user: User, input: UserListingInput) => Promise<Listing>
  getListing: (id: string) => Listing | undefined
  getListingsForUser: (userId: string) => Listing[]
  removeListing: (id: string) => Promise<void>
  recordUniqueView: (listingId: string, options?: { excludeUserId?: string }) => Promise<void>
  getUniqueViews: (listingId: string) => number
}

const VISITOR_KEY = 'carbuy-visitor-id'

const DEFAULT_POSTER =
  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80'

const ListingsContext = createContext<ListingsContextValue | null>(null)

function getVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(VISITOR_KEY, id)
    return id
  } catch {
    return 'anonymous'
  }
}

export function ListingsProvider({ children }: { children: ReactNode }) {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshListings = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError('Supabase nincs beállítva. Add meg a VITE_SUPABASE_* változókat.')
      setListings([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error: queryError } = await supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false })

    if (queryError) {
      setError(queryError.message)
      setListings([])
    } else {
      setError(null)
      setListings((data ?? []).map(mapListingRow))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refreshListings()
  }, [refreshListings])

  const addListing = useCallback(
    async (user: User, input: UserListingInput) => {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase nincs beállítva.')
      }

      const id = createListingId()
      const sellerName =
        user.accountType === 'business' && user.companyName ? user.companyName : user.name
      const description =
        input.description ||
        'Videós bemutatóval feltöltött hirdetés. Élő hívásban bármit megmutatunk.'
      const features = [input.videoName ? 'Videós bemutató' : 'Új hirdetés'].filter(Boolean)
      const specs = [
        { label: 'Évjárat', value: String(input.year) },
        { label: 'Kilométeróra', value: `${input.mileage.toLocaleString('hu-HU')} km` },
        { label: 'Üzemanyag', value: input.fuel },
        { label: 'Váltó', value: input.transmission },
        { label: 'Teljesítmény', value: input.power ? `${input.power} LE` : '—' },
        { label: 'Helyszín', value: input.location },
      ]

      const { data, error: insertError } = await supabase
        .from('listings')
        .insert({
          id,
          owner_id: user.id,
          is_demo: false,
          title: input.title,
          make: input.make,
          model: input.model,
          year: input.year,
          price: input.price,
          mileage: input.mileage,
          fuel: input.fuel,
          transmission: input.transmission,
          power: input.power,
          location: input.location,
          description,
          video_poster: DEFAULT_POSTER,
          video_duration: '1:45',
          features,
          specs,
          seller_name: sellerName,
          seller_type: user.accountType === 'business' ? 'dealer' : 'private',
          seller_status: input.status,
          seller_rating: 5.0,
          seller_response_time: '< 5 perc',
          unique_views: 0,
        })
        .select('*')
        .single()

      if (insertError || !data) {
        throw new Error(insertError?.message ?? 'Hirdetés mentése sikertelen.')
      }

      const listing = mapListingRow(data)
      setListings((prev) => [listing, ...prev.filter((l) => l.id !== listing.id)])
      return listing
    },
    [],
  )

  const getListing = useCallback(
    (id: string) => listings.find((l) => l.id === id),
    [listings],
  )

  const getListingsForUser = useCallback(
    (userId: string) => listings.filter((l) => l.ownerId === userId),
    [listings],
  )

  const removeListing = useCallback(async (id: string) => {
    if (!isSupabaseConfigured) throw new Error('Supabase nincs beállítva.')

    const { error: deleteError } = await supabase.from('listings').delete().eq('id', id)
    if (deleteError) throw new Error(deleteError.message)

    setListings((prev) => prev.filter((l) => l.id !== id))
  }, [])

  const getUniqueViews = useCallback(
    (listingId: string) => listings.find((l) => l.id === listingId)?.uniqueViews ?? 0,
    [listings],
  )

  const recordUniqueView = useCallback(
    async (listingId: string, options?: { excludeUserId?: string }) => {
      if (!isSupabaseConfigured) return

      const listing = listings.find((l) => l.id === listingId)
      if (!listing) return
      if (options?.excludeUserId && listing.ownerId === options.excludeUserId) return

      const visitorId = getVisitorId()
      const { data, error: rpcError } = await supabase.rpc('record_unique_view', {
        p_listing_id: listingId,
        p_visitor_id: visitorId,
      })

      if (rpcError) {
        console.warn('[CarBuy] record_unique_view failed', rpcError.message)
        return
      }

      if (typeof data === 'number') {
        setListings((prev) =>
          prev.map((l) => (l.id === listingId ? { ...l, uniqueViews: data } : l)),
        )
      }
    },
    [listings],
  )

  const value = useMemo(
    () => ({
      listings,
      loading,
      error,
      refreshListings,
      addListing,
      getListing,
      getListingsForUser,
      removeListing,
      recordUniqueView,
      getUniqueViews,
    }),
    [
      listings,
      loading,
      error,
      refreshListings,
      addListing,
      getListing,
      getListingsForUser,
      removeListing,
      recordUniqueView,
      getUniqueViews,
    ],
  )

  return <ListingsContext.Provider value={value}>{children}</ListingsContext.Provider>
}

export function useListings() {
  const ctx = useContext(ListingsContext)
  if (!ctx) throw new Error('useListings must be used within ListingsProvider')
  return ctx
}
