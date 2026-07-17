import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Listing, SellerStatus } from '../data/listings'
import { getListingById as getDemoListing } from '../data/listings'
import type { User } from './AuthContext'
import { createListingId } from '../lib/listingUrl'

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

type ViewsEntry = {
  visitors: string[]
  count: number
}

type ViewsStore = Record<string, ViewsEntry>

type ListingsContextValue = {
  myListings: Listing[]
  addListing: (user: User, input: UserListingInput) => Listing
  getListing: (id: string) => Listing | undefined
  getListingsForUser: (userId: string) => Listing[]
  removeListing: (id: string) => void
  recordUniqueView: (listingId: string, options?: { excludeUserId?: string }) => void
  getUniqueViews: (listingId: string) => number
}

const STORAGE_KEY = 'carbuy-user-listings'
const VIEWS_KEY = 'carbuy-listing-views'
const VISITOR_KEY = 'carbuy-visitor-id'

const DEFAULT_POSTER =
  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80'

const ListingsContext = createContext<ListingsContextValue | null>(null)

function loadAll(): Listing[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Listing[]) : []
  } catch {
    return []
  }
}

function loadViews(): ViewsStore {
  try {
    const raw = localStorage.getItem(VIEWS_KEY)
    return raw ? (JSON.parse(raw) as ViewsStore) : {}
  } catch {
    return {}
  }
}

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
  const [allUserListings, setAllUserListings] = useState<Listing[]>(() => loadAll())
  const [views, setViews] = useState<ViewsStore>(() => loadViews())

  const persistListings = useCallback((next: Listing[]) => {
    setAllUserListings(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const persistViews = useCallback((next: ViewsStore) => {
    setViews(next)
    localStorage.setItem(VIEWS_KEY, JSON.stringify(next))
  }, [])

  const addListing = useCallback(
    (user: User, input: UserListingInput) => {
      const id = createListingId()
      const sellerName =
        user.accountType === 'business' && user.companyName ? user.companyName : user.name

      const listing: Listing = {
        id,
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
        description:
          input.description ||
          'Videós bemutatóval feltöltött hirdetés. Élő hívásban bármit megmutatunk.',
        videoPoster: DEFAULT_POSTER,
        videoDuration: '1:45',
        seller: {
          name: sellerName,
          type: user.accountType === 'business' ? 'dealer' : 'private',
          status: input.status,
          rating: 5.0,
          responseTime: '< 5 perc',
        },
        features: [input.videoName ? 'Videós bemutató' : 'Új hirdetés'].filter(Boolean),
        specs: [
          { label: 'Évjárat', value: String(input.year) },
          { label: 'Kilométeróra', value: `${input.mileage.toLocaleString('hu-HU')} km` },
          { label: 'Üzemanyag', value: input.fuel },
          { label: 'Váltó', value: input.transmission },
          { label: 'Teljesítmény', value: input.power ? `${input.power} LE` : '—' },
          { label: 'Helyszín', value: input.location },
        ],
        ownerId: user.id,
        createdAt: new Date().toISOString(),
        uniqueViews: 0,
      }

      persistListings([listing, ...allUserListings])
      return listing
    },
    [allUserListings, persistListings],
  )

  const getListing = useCallback(
    (id: string) => {
      const userListing = allUserListings.find((l) => l.id === id)
      if (userListing) {
        return {
          ...userListing,
          uniqueViews: views[id]?.count ?? userListing.uniqueViews ?? 0,
        }
      }
      const demo = getDemoListing(id)
      if (!demo) return undefined
      return { ...demo, uniqueViews: views[id]?.count ?? 0 }
    },
    [allUserListings, views],
  )

  const getListingsForUser = useCallback(
    (userId: string) =>
      allUserListings
        .filter((l) => l.ownerId === userId)
        .map((l) => ({
          ...l,
          uniqueViews: views[l.id]?.count ?? l.uniqueViews ?? 0,
        })),
    [allUserListings, views],
  )

  const removeListing = useCallback(
    (id: string) => {
      persistListings(allUserListings.filter((l) => l.id !== id))
      const nextViews = { ...views }
      delete nextViews[id]
      persistViews(nextViews)
    },
    [allUserListings, persistListings, persistViews, views],
  )

  const getUniqueViews = useCallback(
    (listingId: string) => views[listingId]?.count ?? 0,
    [views],
  )

  const recordUniqueView = useCallback(
    (listingId: string, options?: { excludeUserId?: string }) => {
      const listing =
        allUserListings.find((l) => l.id === listingId) ?? getDemoListing(listingId)
      if (!listing) return

      // Owner viewing own listing does not count
      if (options?.excludeUserId && listing.ownerId === options.excludeUserId) return

      const visitorId = getVisitorId()
      const entry = views[listingId] ?? { visitors: [], count: 0 }
      if (entry.visitors.includes(visitorId)) return

      const nextEntry: ViewsEntry = {
        visitors: [...entry.visitors, visitorId],
        count: entry.count + 1,
      }
      const nextViews = { ...views, [listingId]: nextEntry }
      persistViews(nextViews)

      if (listing.ownerId) {
        persistListings(
          allUserListings.map((l) =>
            l.id === listingId ? { ...l, uniqueViews: nextEntry.count } : l,
          ),
        )
      }
    },
    [allUserListings, persistListings, persistViews, views],
  )

  const myListings = allUserListings

  const value = useMemo(
    () => ({
      myListings,
      addListing,
      getListing,
      getListingsForUser,
      removeListing,
      recordUniqueView,
      getUniqueViews,
    }),
    [
      myListings,
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
