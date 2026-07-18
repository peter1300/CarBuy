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
  fuelWeights: Record<string, number>
  priceBuckets: Record<string, number>
  seenIds: string[]
}

const PREFS_KEY = 'carbuy-reel-prefs'

function priceBucket(price: number): string {
  if (price < 2_000_000) return '0-2'
  if (price < 5_000_000) return '2-5'
  if (price < 10_000_000) return '5-10'
  if (price < 20_000_000) return '10-20'
  return '20+'
}

export function loadReelPrefs(): ReelPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) {
      return { makeWeights: {}, fuelWeights: {}, priceBuckets: {}, seenIds: [] }
    }
    const parsed = JSON.parse(raw) as Partial<ReelPrefs>
    return {
      makeWeights: parsed.makeWeights ?? {},
      fuelWeights: parsed.fuelWeights ?? {},
      priceBuckets: parsed.priceBuckets ?? {},
      seenIds: Array.isArray(parsed.seenIds) ? parsed.seenIds.slice(-200) : [],
    }
  } catch {
    return { makeWeights: {}, fuelWeights: {}, priceBuckets: {}, seenIds: [] }
  }
}

function saveReelPrefs(prefs: ReelPrefs) {
  try {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        ...prefs,
        seenIds: prefs.seenIds.slice(-200),
      }),
    )
  } catch {
    /* ignore quota */
  }
}

/** Learn from a watch session — longer watches boost car affinities. */
export function rememberReelWatch(listing: Listing, watchMs: number, durationMs: number) {
  const prefs = loadReelPrefs()
  const ratio = durationMs > 0 ? Math.min(1, watchMs / durationMs) : 0
  const weight = ratio >= 0.55 ? 2 : ratio >= 0.25 ? 1 : ratio < 0.08 ? -1 : 0

  if (weight !== 0) {
    prefs.makeWeights[listing.make] = (prefs.makeWeights[listing.make] ?? 0) + weight
    prefs.fuelWeights[listing.fuel] = (prefs.fuelWeights[listing.fuel] ?? 0) + weight
    const bucket = priceBucket(listing.price)
    prefs.priceBuckets[bucket] = (prefs.priceBuckets[bucket] ?? 0) + weight
  }

  if (!prefs.seenIds.includes(listing.id)) {
    prefs.seenIds.push(listing.id)
  }
  saveReelPrefs(prefs)
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
  const fuel = prefs.fuelWeights[listing.fuel] ?? 0
  const price = prefs.priceBuckets[priceBucket(listing.price)] ?? 0
  const raw = make * 0.5 + fuel * 0.25 + price * 0.25
  // squash to 0–1
  return 1 / (1 + Math.exp(-raw / 3))
}

function exploreBoost(listing: Listing, prefs: ReelPrefs, poolSize: number): number {
  const seen = prefs.seenIds.includes(listing.id)
  if (poolSize < 8) return seen ? 0.15 : 0.55
  return seen ? 0 : 0.25
}

function baseScore(listing: Listing, stats: ReelStats | undefined, prefs: ReelPrefs, poolSize: number): number {
  const watch = stats?.avgWatchRatio ?? 0.2
  const impressions = stats?.impressions ?? 0
  // Cold start: slight optimism so new videos get tested
  const watchSignal = impressions < 3 ? Math.max(watch, 0.35) : watch
  const socialProof = Math.min(1, Math.log10(1 + impressions) / 3)

  const watchWeight = poolSize < 8 ? 0.4 : 0.55
  const freshWeight = poolSize < 8 ? 0.2 : 0.12
  const persoWeight = poolSize < 8 ? 0.15 : 0.18
  const exploreWeight = poolSize < 8 ? 0.2 : 0.1
  const socialWeight = 1 - watchWeight - freshWeight - persoWeight - exploreWeight

  return (
    watchWeight * watchSignal +
    freshWeight * freshnessScore(listing.createdAt) +
    persoWeight * personalizationScore(listing, prefs) +
    exploreWeight * exploreBoost(listing, prefs, poolSize) +
    socialWeight * socialProof
  )
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
      score: baseScore(listing, statsMap.get(listing.id), prefs, poolSize) + Math.random() * 0.04,
    }))
    .sort((a, b) => b.score - a.score)

  // Diversity: avoid same make back-to-back when pool allows
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
