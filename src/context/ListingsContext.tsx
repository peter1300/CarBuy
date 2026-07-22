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
import { ensureProfile, useAuth, type User } from './AuthContext'
import { useLocale } from '../i18n/LocaleContext'
import type { MarketCountry } from '../i18n/locales'
import { createListingId } from '../lib/listingUrl'
import {
  isAllowedListingVideo,
  MAX_LISTING_VIDEO_BYTES,
} from '../lib/listingVideo'
import { LISTING_SUMMARY_COLUMNS } from '../lib/listingQueries'
import { buildListingSpecs, type UserListingUpdateInput } from '../lib/listingSpecs'
import { mapListingRow } from '../lib/mapListing'
import { processListingVideos } from '../lib/processListingVideos'
import {
  listPendingListingVideosForOwner,
  loadPendingListingVideos,
  pendingRecordToFiles,
  removePendingListingVideos,
  savePendingListingVideos,
} from '../lib/listingVideoQueue'
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
  syncOwnerPendingListings: (ownerId: string) => Promise<void>
  resumeListingVideoProcessing: (ownerId: string) => Promise<void>
  addListing: (
    user: User,
    input: UserListingInput,
    options?: { onStatus?: (status: string) => void },
  ) => Promise<Listing>
  updateListing: (user: User, listingId: string, input: UserListingUpdateInput) => Promise<Listing>
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
  const { user } = useAuth()
  const { browseCountry } = useLocale()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const listingsRef = useRef(listings)
  const activeProcessingRef = useRef(new Set<string>())

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
      .eq('processing_status', 'ready')
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

  const syncOwnerPendingListings = useCallback(async (ownerId: string) => {
    if (!isSupabaseConfigured) return

    const { data, error: queryError } = await supabase
      .from('listings')
      .select(LISTING_SUMMARY_COLUMNS)
      .eq('owner_id', ownerId)
      .in('processing_status', ['processing', 'failed'])

    if (queryError || !data) return

    const pending = data.map(mapListingRow)
    setListings((prev) => {
      const withoutOwnerPending = prev.filter(
        (listing) =>
          listing.ownerId !== ownerId ||
          (listing.processingStatus !== 'processing' && listing.processingStatus !== 'failed'),
      )
      return [...pending, ...withoutOwnerPending]
    })
  }, [])

  const markListingProcessingFailed = useCallback(async (listingId: string) => {
    await supabase.from('listings').update({ processing_status: 'failed' }).eq('id', listingId)
    setListings((prev) =>
      prev.map((item) => (item.id === listingId ? { ...item, processingStatus: 'failed' } : item)),
    )
  }, [])

  const runListingVideoProcessing = useCallback(
    (
      listingId: string,
      ownerId: string,
      videoFile: File,
      flawsVideoFile: File | null | undefined,
    ) => {
      if (activeProcessingRef.current.has(listingId)) return
      activeProcessingRef.current.add(listingId)

      void (async () => {
        try {
          const result = await processListingVideos({
            listingId,
            ownerId,
            videoFile,
            flawsVideoFile: flawsVideoFile ?? null,
          })

          const { data, error: updateError } = await supabase
            .from('listings')
            .update({
              video_url: result.videoUrl,
              flaws_video_url: result.flawsVideoUrl,
              video_poster: result.posterUrl,
              video_duration: result.durationLabel,
              video_size_bytes: result.videoSizeBytes,
              processing_status: 'ready',
            })
            .eq('id', listingId)
            .select('*')
            .single()

          if (updateError || !data) {
            throw new Error(updateError?.message ?? tGlobal('errors.listingSaveFailed'))
          }

          await removePendingListingVideos(listingId)

          const listing = mapListingRow(data)
          setListings((prev) => {
            const without = prev.filter((item) => item.id !== listing.id)
            return [listing, ...without]
          })
        } catch (err) {
          console.warn('[CarBuy] listing video processing failed', err)
          await markListingProcessingFailed(listingId)
        } finally {
          activeProcessingRef.current.delete(listingId)
        }
      })()
    },
    [markListingProcessingFailed],
  )

  const resumeListingVideoProcessing = useCallback(
    async (ownerId: string) => {
      if (!isSupabaseConfigured) return

      await syncOwnerPendingListings(ownerId)

      const { data: processingRows } = await supabase
        .from('listings')
        .select('id, video_url, created_at')
        .eq('owner_id', ownerId)
        .eq('processing_status', 'processing')

      const queued = await listPendingListingVideosForOwner(ownerId)
      const queuedIds = new Set(queued.map((record) => record.listingId))
      /** Client-side encode/upload stuck longer than this → mark failed (user can re-upload). */
      const STALE_PROCESSING_MS = 25 * 60 * 1000
      const now = Date.now()

      for (const row of processingRows ?? []) {
        const hasQueue = queuedIds.has(row.id)
        const createdAt = Date.parse(row.created_at)
        const isStale =
          Number.isFinite(createdAt) && now - createdAt > STALE_PROCESSING_MS

        if (!hasQueue && !row.video_url) {
          await markListingProcessingFailed(row.id)
          continue
        }

        // Queued blob gone but still "processing" for a long time → fail cleanly.
        if (!hasQueue) {
          if (isStale) await markListingProcessingFailed(row.id)
          continue
        }

        const pending = await loadPendingListingVideos(row.id)
        if (!pending) {
          if (isStale) await markListingProcessingFailed(row.id)
          continue
        }

        const { videoFile, flawsVideoFile } = pendingRecordToFiles(pending)
        runListingVideoProcessing(row.id, ownerId, videoFile, flawsVideoFile)
      }
    },
    [markListingProcessingFailed, runListingVideoProcessing, syncOwnerPendingListings],
  )

  useEffect(() => {
    if (!user?.id) return
    void resumeListingVideoProcessing(user.id)
  }, [user?.id, resumeListingVideoProcessing])

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
      const specs = buildListingSpecs(input)

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

      options?.onStatus?.(tGlobal('create.saving'))

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
          video_poster: DEFAULT_POSTER,
          video_url: null,
          flaws_video_url: null,
          video_duration: '—',
          features,
          specs,
          seller_name: sellerName,
          seller_type: profile.accountType === 'business' ? 'dealer' : 'private',
          seller_status: input.status,
          seller_rating: 5.0,
          seller_response_time: tGlobal('errors.responseTime'),
          seller_avatar_url: profile.avatarUrl ?? null,
          unique_views: 0,
          processing_status: 'processing',
        })
        .select('*')
        .single()

      if (insertError || !data) {
        const msg = insertError?.message ?? tGlobal('errors.listingSaveFailed')
        if (
          /row-level security|RLS|permission denied|violates foreign key|video_url|flaws_video_url|processing_status/i.test(
            msg,
          )
        ) {
          throw new Error(tGlobal('errors.listingSaveRls'))
        }
        throw new Error(msg)
      }

      const listing = mapListingRow(data)
      setListings((prev) => [listing, ...prev.filter((l) => l.id !== listing.id)])

      await savePendingListingVideos({
        listingId: id,
        ownerId,
        videoFile: rawFile,
        flawsVideoFile: rawFlaws,
      })
      runListingVideoProcessing(id, ownerId, rawFile, rawFlaws)

      return listing
    },
    [runListingVideoProcessing],
  )

  const updateListing = useCallback(
    async (user: User, listingId: string, input: UserListingUpdateInput) => {
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

      const existing = listingsRef.current.find((listing) => listing.id === listingId)
      if (!existing?.ownerId || existing.ownerId !== user.id) {
        throw new Error(tGlobal('editListing.notOwner'))
      }

      const description = input.description || tGlobal('errors.defaultDescription')
      const specs = buildListingSpecs(input)

      const { data, error: updateError } = await supabase
        .from('listings')
        .update({
          title: input.title,
          year: input.year,
          price: input.price,
          mileage: input.mileage,
          fuel: input.fuel,
          transmission: input.transmission,
          power: input.power,
          location: input.location,
          description,
          specs,
          seller_status: input.status,
        })
        .eq('id', listingId)
        .eq('owner_id', user.id)
        .select('*')
        .single()

      if (updateError || !data) {
        throw new Error(updateError?.message ?? tGlobal('errors.listingSaveFailed'))
      }

      const listing = mapListingRow(data)
      setListings((prev) => prev.map((item) => (item.id === listing.id ? listing : item)))
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

      await removePendingListingVideos(id)

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
      syncOwnerPendingListings,
      resumeListingVideoProcessing,
      addListing,
      updateListing,
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
      syncOwnerPendingListings,
      resumeListingVideoProcessing,
      addListing,
      updateListing,
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
