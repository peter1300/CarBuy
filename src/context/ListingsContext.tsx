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
import { ensureProfile, type User } from './AuthContext'
import { createListingId } from '../lib/listingUrl'
import {
  captureVideoPoster,
  isAllowedListingVideo,
  MAX_LISTING_VIDEO_BYTES,
} from '../lib/listingVideo'
import { compressVideoForUpload } from '../lib/compressVideo'
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
  videoFile: File
  flawsVideoFile: File
  status: SellerStatus
}

type ListingsContextValue = {
  listings: Listing[]
  loading: boolean
  error: string | null
  refreshListings: () => Promise<void>
  addListing: (
    user: User,
    input: UserListingInput,
    options?: { onStatus?: (status: string) => void },
  ) => Promise<Listing>
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
      const mapped = (data ?? []).map(mapListingRow)
      mapped.sort((a, b) => {
        const aTime = a.createdAt ? Date.parse(a.createdAt) : 0
        const bTime = b.createdAt ? Date.parse(b.createdAt) : 0
        return bTime - aTime
      })
      setListings(mapped)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refreshListings()
  }, [refreshListings])

  const addListing = useCallback(
    async (
      _user: User,
      input: UserListingInput,
      options?: { onStatus?: (status: string) => void },
    ) => {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase nincs beállítva.')
      }

      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !authUser) {
        throw new Error('A munkamenet lejárt. Lépj be újra, majd próbáld meg ismét.')
      }

      // Profile row is required (FK + RLS). Create/repair before insert.
      const profile = await ensureProfile(authUser)
      const ownerId = profile.id

      const id = createListingId()
      const sellerName =
        profile.accountType === 'business' && profile.companyName
          ? profile.companyName
          : profile.name
      const description =
        input.description ||
        'Videós bemutatóval feltöltött hirdetés. Élő hívásban bármit megmutatunk.'
      const features = ['Videós bemutató']
      const specs = [
        { label: 'Évjárat', value: String(input.year) },
        { label: 'Kilométeróra', value: `${input.mileage.toLocaleString('hu-HU')} km` },
        { label: 'Üzemanyag', value: input.fuel },
        { label: 'Váltó', value: input.transmission },
        { label: 'Teljesítmény', value: input.power ? `${input.power} LE` : '—' },
        { label: 'Helyszín', value: input.location },
      ]

      const rawFile = input.videoFile
      if (!isAllowedListingVideo(rawFile)) {
        throw new Error('Csak videófájl tölthető fel (MP4, MOV, WebM).')
      }
      if (rawFile.size > MAX_LISTING_VIDEO_BYTES) {
        throw new Error('A videó maximum 150 MB lehet.')
      }

      const rawFlaws = input.flawsVideoFile
      if (!isAllowedListingVideo(rawFlaws)) {
        throw new Error('A hibák videója csak videófájl lehet (MP4, MOV, WebM).')
      }
      if (rawFlaws.size > MAX_LISTING_VIDEO_BYTES) {
        throw new Error('A hibák videója maximum 150 MB lehet.')
      }

      options?.onStatus?.('Bemutatóvideó tömörítése…')
      const file = await compressVideoForUpload(rawFile, {
        onProgress: ({ phase, ratio }) => {
          if (phase === 'loading') {
            options?.onStatus?.('Tömörítő betöltése…')
            return
          }
          options?.onStatus?.(
            `Bemutatóvideó tömörítése… ${Math.round(ratio * 100)}%`,
          )
        },
      })

      options?.onStatus?.('Hibák videó tömörítése…')
      const flawsFile = await compressVideoForUpload(rawFlaws, {
        onProgress: ({ phase, ratio }) => {
          if (phase === 'loading') {
            options?.onStatus?.('Tömörítő betöltése…')
            return
          }
          options?.onStatus?.(
            `Hibák videó tömörítése… ${Math.round(ratio * 100)}%`,
          )
        },
      })

      options?.onStatus?.('Előnézet készítése…')
      const { blob: posterBlob, durationLabel } = await captureVideoPoster(file)

      const videoPath = `${ownerId}/${id}/video.mp4`
      const flawsPath = `${ownerId}/${id}/flaws.mp4`
      const posterPath = `${ownerId}/${id}/poster.jpg`

      options?.onStatus?.('Videók feltöltése…')
      const { error: videoUploadError } = await supabase.storage
        .from('listing-videos')
        .upload(videoPath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'video/mp4',
        })
      if (videoUploadError) {
        throw new Error(videoUploadError.message || 'Videó feltöltése sikertelen.')
      }

      const { error: flawsUploadError } = await supabase.storage
        .from('listing-videos')
        .upload(flawsPath, flawsFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'video/mp4',
        })
      if (flawsUploadError) {
        throw new Error(flawsUploadError.message || 'Hibák videó feltöltése sikertelen.')
      }

      const { error: posterUploadError } = await supabase.storage
        .from('listing-videos')
        .upload(posterPath, posterBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/jpeg',
        })
      if (posterUploadError) {
        throw new Error(posterUploadError.message || 'Előnézet feltöltése sikertelen.')
      }

      options?.onStatus?.('Hirdetés mentése…')
      const {
        data: { publicUrl: videoUrl },
      } = supabase.storage.from('listing-videos').getPublicUrl(videoPath)
      const {
        data: { publicUrl: flawsVideoUrl },
      } = supabase.storage.from('listing-videos').getPublicUrl(flawsPath)
      const {
        data: { publicUrl: posterUrl },
      } = supabase.storage.from('listing-videos').getPublicUrl(posterPath)

      const { data, error: insertError } = await supabase
        .from('listings')
        .insert({
          id,
          owner_id: ownerId,
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
          video_poster: posterUrl || DEFAULT_POSTER,
          video_url: videoUrl,
          flaws_video_url: flawsVideoUrl,
          video_duration: durationLabel,
          features,
          specs,
          seller_name: sellerName,
          seller_type: profile.accountType === 'business' ? 'dealer' : 'private',
          seller_status: input.status,
          seller_rating: 5.0,
          seller_response_time: '< 5 perc',
          seller_avatar_url: profile.avatarUrl ?? null,
          unique_views: 0,
        })
        .select('*')
        .single()

      if (insertError || !data) {
        const msg = insertError?.message ?? 'Hirdetés mentése sikertelen.'
        if (
          /row-level security|RLS|permission denied|violates foreign key|video_url|flaws_video_url/i.test(
            msg,
          )
        ) {
          throw new Error(
            'A hirdetés mentése az adatbázisban meghiúsult. Futtasd a supabase/migrations/005_listing_videos.sql és 006_flaws_video.sql fájlokat a Supabase SQL Editorban, majd próbáld újra.',
          )
        }
        throw new Error(msg)
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
