import type { Listing } from '../data/listings'
import { isSupabaseConfigured, supabase } from './supabase'

export type ReelStats = {
  listingId: string
  impressions: number
  totalWatchMs: number
  completions: number
  avgWatchRatio: number
}

export type ReelPrefs = {
  makeWeights: Record<string, number>
  modelWeights: Record<string, number>
  fuelWeights: Record<string, number>
  priceBuckets: Record<string, number>
  favoriteIds: string[]
  seenIds: string[]
}

const PREFS_KEY = 'carbuy-reel-prefs'

function emptyPrefs(): ReelPrefs {
  return {
    makeWeights: {},
    modelWeights: {},
    fuelWeights: {},
    priceBuckets: {},
    favoriteIds: [],
    seenIds: [],
  }
}

function priceBucket(price: number): string {
  if (price < 2_000_000) return '0-2'
  if (price < 5_000_000) return '2-5'
  if (price < 10_000_000) return '5-10'
  if (price < 20_000_000) return '10-20'
  return '20+'
}

function modelKey(listing: Pick<Listing, 'make' | 'model'>): string {
  return `${listing.make}::${listing.model}`.toLowerCase()
}

export function loadReelPrefs(): ReelPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return emptyPrefs()
    const parsed = JSON.parse(raw) as Partial<ReelPrefs>
    return {
      makeWeights: parsed.makeWeights ?? {},
      modelWeights: parsed.modelWeights ?? {},
      fuelWeights: parsed.fuelWeights ?? {},
      priceBuckets: parsed.priceBuckets ?? {},
      favoriteIds: Array.isArray(parsed.favoriteIds) ? parsed.favoriteIds.slice(-200) : [],
      seenIds: Array.isArray(parsed.seenIds) ? parsed.seenIds.slice(-200) : [],
    }
  } catch {
    return emptyPrefs()
  }
}

function saveReelPrefs(prefs: ReelPrefs) {
  try {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        ...prefs,
        favoriteIds: prefs.favoriteIds.slice(-200),
        seenIds: prefs.seenIds.slice(-200),
      }),
    )
  } catch {
    /* ignore quota */
  }
}

function bumpAffinity(prefs: ReelPrefs, listing: Listing, weight: number) {
  if (weight === 0) return
  prefs.makeWeights[listing.make] = (prefs.makeWeights[listing.make] ?? 0) + weight
  prefs.modelWeights[modelKey(listing)] =
    (prefs.modelWeights[modelKey(listing)] ?? 0) + weight * 1.25
  prefs.fuelWeights[listing.fuel] = (prefs.fuelWeights[listing.fuel] ?? 0) + weight * 0.85
  const bucket = priceBucket(listing.price)
  prefs.priceBuckets[bucket] = (prefs.priceBuckets[bucket] ?? 0) + weight * 0.75
}

/** Learn from a watch session — longer watches boost car affinities. */
export function rememberReelWatch(listing: Listing, watchMs: number, durationMs: number) {
  const prefs = loadReelPrefs()
  const ratio = durationMs > 0 ? Math.min(1, watchMs / durationMs) : 0
  const weight = ratio >= 0.55 ? 2 : ratio >= 0.25 ? 1 : ratio < 0.08 ? -1 : 0
  bumpAffinity(prefs, listing, weight)

  if (!prefs.seenIds.includes(listing.id)) {
    prefs.seenIds.push(listing.id)
  }
  saveReelPrefs(prefs)
}

/** Strong positive signal when user favorites a car. */
export function rememberFavorite(listing: Listing) {
  const prefs = loadReelPrefs()
  bumpAffinity(prefs, listing, 5)
  if (!prefs.favoriteIds.includes(listing.id)) {
    prefs.favoriteIds.push(listing.id)
  }
  saveReelPrefs(prefs)
}

/** Soften affinities when a favorite is removed. */
export function forgetFavorite(listing: Listing) {
  const prefs = loadReelPrefs()
  bumpAffinity(prefs, listing, -3)
  prefs.favoriteIds = prefs.favoriteIds.filter((id) => id !== listing.id)
  saveReelPrefs(prefs)
}

/** Opening a listing detail teaches make/model preferences. */
export function rememberListingOpen(listing: Listing) {
  const prefs = loadReelPrefs()
  bumpAffinity(prefs, listing, 1.5)
  if (!prefs.seenIds.includes(listing.id)) {
    prefs.seenIds.push(listing.id)
  }
  saveReelPrefs(prefs)
}

/** Sync favorite IDs from the server into local prefs (without double-bumping). */
export function syncFavoriteIds(ids: string[]) {
  const prefs = loadReelPrefs()
  prefs.favoriteIds = [...new Set(ids)].slice(-200)
  saveReelPrefs(prefs)
}

export function hasPersonalization(prefs: ReelPrefs = loadReelPrefs()): boolean {
  return (
    prefs.favoriteIds.length > 0 ||
    Object.keys(prefs.makeWeights).length > 0 ||
    Object.keys(prefs.modelWeights).length > 0 ||
    Object.keys(prefs.fuelWeights).length > 0 ||
    Object.keys(prefs.priceBuckets).length > 0
  )
}

export async function fetchReelStats(): Promise<Map<string, ReelStats>> {
  const map = new Map<string, ReelStats>()
  if (!isSupabaseConfigured) return map

  const { data, error } = await supabase.from('reel_stats').select('*')
  if (error || !data) return map

  for (const row of data) {
    map.set(row.listing_id, {
      listingId: row.listing_id,
      impressions: row.impressions,
      totalWatchMs: Number(row.total_watch_ms),
      completions: row.completions,
      avgWatchRatio: Number(row.avg_watch_ratio),
    })
  }
  return map
}

export async function reportReelWatch(input: {
  listingId: string
  watchMs: number
  durationMs: number
  completed: boolean
}) {
  if (!isSupabaseConfigured) return
  if (input.watchMs < 400) return

  await supabase.rpc('record_reel_watch', {
    p_listing_id: input.listingId,
    p_watch_ms: Math.round(input.watchMs),
    p_duration_ms: Math.max(1, Math.round(input.durationMs)),
    p_completed: input.completed,
  })
}

function freshnessScore(createdAt?: string): number {
  if (!createdAt) return 0.35
  const ageHours = (Date.now() - Date.parse(createdAt)) / (1000 * 60 * 60)
  if (!Number.isFinite(ageHours) || ageHours < 0) return 0.35
  if (ageHours < 24) return 1
  if (ageHours < 72) return 0.75
  if (ageHours < 168) return 0.5
  if (ageHours < 720) return 0.3
  return 0.15
}

function personalizationScore(listing: Listing, prefs: ReelPrefs): number {
  const make = prefs.makeWeights[listing.make] ?? 0
  const model = prefs.modelWeights[modelKey(listing)] ?? 0
  const fuel = prefs.fuelWeights[listing.fuel] ?? 0
  const price = prefs.priceBuckets[priceBucket(listing.price)] ?? 0
  const favoriteBoost = prefs.favoriteIds.includes(listing.id) ? 2 : 0
  const raw = make * 0.4 + model * 0.35 + fuel * 0.15 + price * 0.15 + favoriteBoost
  return 1 / (1 + Math.exp(-raw / 4))
}

function exploreBoost(listing: Listing, prefs: ReelPrefs, poolSize: number): number {
  const seen = prefs.seenIds.includes(listing.id)
  if (poolSize < 8) return seen ? 0.15 : 0.55
  return seen ? 0 : 0.25
}

function persoWeightFor(prefs: ReelPrefs, poolSize: number, videoFeed: boolean): number {
  const strong = hasPersonalization(prefs)
  if (videoFeed) {
    if (poolSize < 8) return strong ? 0.28 : 0.15
    return strong ? 0.32 : 0.18
  }
  return strong ? 0.45 : 0.2
}

function baseScore(
  listing: Listing,
  stats: ReelStats | undefined,
  prefs: ReelPrefs,
  poolSize: number,
  videoFeed: boolean,
): number {
  const watch = stats?.avgWatchRatio ?? 0.2
  const impressions = stats?.impressions ?? 0
  const watchSignal = impressions < 3 ? Math.max(watch, 0.35) : watch
  const socialProof = Math.min(1, Math.log10(1 + impressions) / 3)
  const persoWeight = persoWeightFor(prefs, poolSize, videoFeed)

  if (!videoFeed) {
    const freshWeight = 0.25
    const exploreWeight = 0.15
    const rest = Math.max(0, 1 - persoWeight - freshWeight - exploreWeight)
    return (
      persoWeight * personalizationScore(listing, prefs) +
      freshWeight * freshnessScore(listing.createdAt) +
      exploreWeight * exploreBoost(listing, prefs, poolSize) +
      rest * 0.35
    )
  }

  const watchWeight = poolSize < 8 ? 0.35 : 0.45
  const freshWeight = poolSize < 8 ? 0.15 : 0.1
  const exploreWeight = poolSize < 8 ? 0.15 : 0.08
  const socialWeight = Math.max(0.05, 1 - watchWeight - freshWeight - persoWeight - exploreWeight)

  return (
    watchWeight * watchSignal +
    freshWeight * freshnessScore(listing.createdAt) +
    persoWeight * personalizationScore(listing, prefs) +
    exploreWeight * exploreBoost(listing, prefs, poolSize) +
    socialWeight * socialProof
  )
}

function rankWithDiversity(
  scored: { listing: Listing; score: number }[],
): Listing[] {
  const result: Listing[] = []
  const remaining = [...scored]

  while (remaining.length > 0) {
    const lastMake = result[result.length - 1]?.make
    let pickIndex = 0
    if (lastMake && remaining.length > 1) {
      const alt = remaining.findIndex((item) => item.listing.make !== lastMake)
      if (alt >= 0 && alt < Math.min(4, remaining.length)) pickIndex = alt
    }
    const [picked] = remaining.splice(pickIndex, 1)
    result.push(picked.listing)
  }

  return result
}

/** Rank listing main videos for the Reels feed (car-specialized). */
export function rankReelsFeed(
  listings: Listing[],
  statsMap: Map<string, ReelStats>,
  prefs: ReelPrefs = loadReelPrefs(),
): Listing[] {
  const withVideo = listings.filter((l) => Boolean(l.videoUrl))
  const poolSize = withVideo.length
  if (poolSize === 0) return []

  const scored = withVideo
    .map((listing) => ({
      listing,
      score: baseScore(listing, statsMap.get(listing.id), prefs, poolSize, true) + Math.random() * 0.04,
    }))
    .sort((a, b) => b.score - a.score)

  return rankWithDiversity(scored)
}

/** Rank homepage / browse recommendations from favorites + opens + watches. */
export function rankRecommendedListings(
  listings: Listing[],
  prefs: ReelPrefs = loadReelPrefs(),
  limit = 8,
): Listing[] {
  if (listings.length === 0) return []
  const poolSize = listings.length
  const scored = listings
    .map((listing) => ({
      listing,
      score: baseScore(listing, undefined, prefs, poolSize, false) + Math.random() * 0.03,
    }))
    .sort((a, b) => b.score - a.score)

  return rankWithDiversity(scored).slice(0, limit)
}
