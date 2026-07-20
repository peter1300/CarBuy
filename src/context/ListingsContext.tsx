import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Listing, SellerStatus } from '../data/listings'
import { ensureProfile, type User } from './AuthContext'
import { useLocale } from '../i18n/LocaleContext'
import type { MarketCountry } from '../i18n/locales'
import { createListingId } from '../lib/listingUrl'
import {
  captureVideoPoster,
  isAllowedListingVideo,
  MAX_LISTING_VIDEO_BYTES,
} from '../lib/listingVideo'
import { LISTING_SUMMARY_COLUMNS } from '../lib/listingQueries'
import { mapListingRow } from '../lib/mapListing'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { tGlobal } from '../i18n/messages'

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
  country: MarketCountry
  description: string
  videoFile: File
  flawsVideoFile?: File | null
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
  removeListing: (id: string, reason?: 'sold_carbuy' | 'sold_elsewhere' | 'not_sold') => Promise<void>
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
  const { browseCountry } = useLocale()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const listingsRef = useRef(listings)

  useEffect(() => {
    listingsRef.current = listings
  }, [listings])

  const refreshListings = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError(tGlobal('errors.supabaseMissing'))
      setListings([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error: queryError } = await supabase
      .from('listings')
      .select(LISTING_SUMMARY_COLUMNS)
      .eq('country', browseCountry)
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
  }, [browseCountry])

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
        throw new Error(tGlobal('errors.supabaseMissing'))
      }

      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !authUser) {
        throw new Error(tGlobal('errors.sessionExpired'))
      }

      // Profile row is required (FK + RLS). Create/repair before insert.
      const profile = await ensureProfile(authUser)
      const ownerId = profile.id

      const id = createListingId()
      const sellerName =
        profile.accountType === 'business' && profile.companyName
          ? profile.companyName
          : profile.name
      const description = input.description || tGlobal('errors.defaultDescription')
      const features = [tGlobal('errors.featureVideo')]
      const specs = [
        { label: tGlobal('errors.specYear'), value: String(input.year) },
        {
          label: tGlobal('errors.specMileage'),
          value: `${input.mileage.toLocaleString()} km`,
        },
        { label: tGlobal('errors.specFuel'), value: input.fuel },
        { label: tGlobal('errors.specTransmission'), value: input.transmission },
        {
          label: tGlobal('errors.specPower'),
          value: input.power ? tGlobal('product.power', { power: input.power }) : '—',
        },
        { label: tGlobal('errors.specLocation'), value: input.location },
      ]

      const rawFile = input.videoFile
      if (!isAllowedListingVideo(rawFile)) {
        throw new Error(tGlobal('create.videoTypeError'))
      }
      if (rawFile.size > MAX_LISTING_VIDEO_BYTES) {
        throw new Error(tGlobal('create.videoSizeError'))
      }

      const rawFlaws = input.flawsVideoFile ?? null
      if (rawFlaws) {
        if (!isAllowedListingVideo(rawFlaws)) {
          throw new Error(tGlobal('create.videoTypeError'))
        }
        if (rawFlaws.size > MAX_LISTING_VIDEO_BYTES) {
          throw new Error(tGlobal('create.videoSizeError'))
        }
      }

      options?.onStatus?.(tGlobal('create.compressing'))
      const { compressVideoForUpload } = await import('../lib/compressVideo')
      const file = await compressVideoForUpload(rawFile, {
        onProgress: ({ phase, ratio }) => {
          if (phase === 'loading') {
            options?.onStatus?.(tGlobal('create.compressing'))
            return
          }
          options?.onStatus?.(
            `${tGlobal('create.compressing')} ${Math.round(ratio * 100)}%`,
          )
        },
      })

      let flawsFile: File | null = null
      if (rawFlaws) {
        options?.onStatus?.(tGlobal('create.compressing'))
        flawsFile = await compressVideoForUpload(rawFlaws, {
          onProgress: ({ phase, ratio }) => {
            if (phase === 'loading') {
              options?.onStatus?.(tGlobal('create.compressing'))
              return
            }
            options?.onStatus?.(
              `${tGlobal('create.compressing')} ${Math.round(ratio * 100)}%`,
            )
          },
        })
      }

      options?.onStatus?.(tGlobal('create.publishing'))
      const { blob: posterBlob, durationLabel } = await captureVideoPoster(file)

      const videoPath = `${ownerId}/${id}/video.mp4`
      const posterPath = `${ownerId}/${id}/poster.jpg`

      options?.onStatus?.(tGlobal('create.publishing'))
      const { error: videoUploadError } = await supabase.storage
        .from('listing-videos')
        .upload(videoPath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'video/mp4',
        })
      if (videoUploadError) {
        throw new Error(videoUploadError.message || tGlobal('errors.generic'))
      }

      let flawsVideoUrl: string | null = null
      if (flawsFile) {
        const flawsPath = `${ownerId}/${id}/flaws.mp4`
        const { error: flawsUploadError } = await supabase.storage
          .from('listing-videos')
          .upload(flawsPath, flawsFile, {
            cacheControl: '3600',
            upsert: false,
            contentType: 'video/mp4',
          })
        if (flawsUploadError) {
          throw new Error(flawsUploadError.message || tGlobal('errors.generic'))
        }
        const {
          data: { publicUrl },
        } = supabase.storage.from('listing-videos').getPublicUrl(flawsPath)
        flawsVideoUrl = publicUrl
      }

      const { error: posterUploadError } = await supabase.storage
        .from('listing-videos')
        .upload(posterPath, posterBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/jpeg',
        })
      if (posterUploadError) {
        throw new Error(posterUploadError.message || tGlobal('errors.generic'))
      }

      options?.onStatus?.(tGlobal('create.publishing'))
      const {
        data: { publicUrl: videoUrl },
      } = supabase.storage.from('listing-videos').getPublicUrl(videoPath)
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
          country: input.country,
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
          seller_response_time: tGlobal('errors.responseTime'),
          seller_avatar_url: profile.avatarUrl ?? null,
          unique_views: 0,
        })
        .select('*')
        .single()

      if (insertError || !data) {
        const msg = insertError?.message ?? tGlobal('errors.listingSaveFailed')
        if (
          /row-level security|RLS|permission denied|violates foreign key|video_url|flaws_video_url/i.test(
            msg,
          )
        ) {
          throw new Error(tGlobal('errors.listingSaveRls'))
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

  const removeListing = useCallback(
    async (id: string, reason?: 'sold_carbuy' | 'sold_elsewhere' | 'not_sold') => {
      if (!isSupabaseConfigured) throw new Error(tGlobal('errors.supabaseMissing'))

      const listing = listingsRef.current.find((l) => l.id === id)

      if (reason && listing?.ownerId) {
        await supabase.from('listing_deletions').insert({
          listing_id: id,
          owner_id: listing.ownerId,
          reason,
          listing_title: listing.title,
          listing_make: listing.make,
          listing_model: listing.model,
          listing_price: listing.price,
        })
      }

      const { error: deleteError } = await supabase.from('listings').delete().eq('id', id)
      if (deleteError) throw new Error(deleteError.message)

      setListings((prev) => prev.filter((l) => l.id !== id))
    },
    [],
  )

  const getUniqueViews = useCallback(
    (listingId: string) => listings.find((l) => l.id === listingId)?.uniqueViews ?? 0,
    [listings],
  )

  const recordUniqueView = useCallback(
    async (listingId: string, options?: { excludeUserId?: string }) => {
      if (!isSupabaseConfigured) return

      const listing = listingsRef.current.find((l) => l.id === listingId)
      if (!listing) return
      if (options?.excludeUserId && listing.ownerId === options.excludeUserId) return

      const visitorId = getVisitorId()
      const { data, error: rpcError } = await supabase.rpc('record_unique_view', {
        p_listing_id: listingId,
        p_visitor_id: visitorId,
      })

      if (rpcError) {
        if (import.meta.env.DEV) {
          console.warn('[CarBuy] record_unique_view failed', rpcError.message)
        }
        return
      }

      if (typeof data === 'number') {
        setListings((prev) =>
          prev.map((l) => (l.id === listingId ? { ...l, uniqueViews: data } : l)),
        )
      }
    },
    [],
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
