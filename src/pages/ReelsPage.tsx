import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useListings } from '../context/ListingsContext'
import { formatListingTitle, formatMileage, formatPrice } from '../data/listings'
import type { Listing } from '../data/listings'
import { listingPath } from '../lib/listingUrl'
import {
  fetchReelStats,
  loadReelPrefs,
  rankReelsFeed,
  rememberReelWatch,
  reportReelWatch,
  type ReelStats,
} from '../lib/reels'
import { StatusBadge } from '../components/StatusBadge'

type SessionWatch = {
  listingId: string
  watchMs: number
  durationMs: number
  completed: boolean
}

function flushWatch(session: SessionWatch, listing: Listing | undefined) {
  if (!listing || session.watchMs < 400) return
  rememberReelWatch(listing, session.watchMs, session.durationMs || 1)
  void reportReelWatch({
    listingId: session.listingId,
    watchMs: session.watchMs,
    durationMs: session.durationMs || 1,
    completed: session.completed,
  })
}

export function ReelsPage() {
  const { listings, loading, error } = useListings()
  const [statsReady, setStatsReady] = useState(false)
  const [statsVersion, setStatsVersion] = useState(0)
  const [statsMap, setStatsMap] = useState(() => new Map<string, ReelStats>())
  const [activeIndex, setActiveIndex] = useState(0)
  const [userInteracted, setUserInteracted] = useState(false)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const sessionRef = useRef<SessionWatch | null>(null)
  const lastTickRef = useRef(0)
  const listingsRef = useRef<Listing[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const map = await fetchReelStats()
      if (cancelled) return
      setStatsMap(map)
      setStatsReady(true)
      setStatsVersion((v) => v + 1)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const feed = useMemo(() => {
    const prefs = loadReelPrefs()
    return rankReelsFeed(listings, statsMap, prefs)
    // statsVersion forces re-rank after stats load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, statsMap, statsVersion])

  listingsRef.current = feed

  useEffect(() => {
    document.body.classList.add('reels-mode')

    const handleInteraction = () => {
      setUserInteracted(true)
      const video = videoRefs.current[activeIndex]
      if (video) {
        video.muted = false
        void video.play().catch(() => undefined)
      }
    }

    const scroller = scrollerRef.current
    document.addEventListener('click', handleInteraction, { once: true })
    document.addEventListener('touchstart', handleInteraction, { once: true })
    scroller?.addEventListener('scroll', handleInteraction, { once: true, passive: true })

    return () => {
      document.body.classList.remove('reels-mode')
      document.removeEventListener('click', handleInteraction)
      document.removeEventListener('touchstart', handleInteraction)
      scroller?.removeEventListener('scroll', handleInteraction)
      const session = sessionRef.current
      if (session) {
        const listing = listingsRef.current.find((l) => l.id === session.listingId)
        flushWatch(session, listing)
        sessionRef.current = null
      }
    }
  }, [activeIndex])

  useEffect(() => {
    const root = scrollerRef.current
    if (!root) return

    const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-reel-index]'))
    if (slides.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio >= 0.65)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (!visible) return
        const index = Number((visible.target as HTMLElement).dataset.reelIndex)
        if (Number.isFinite(index)) setActiveIndex(index)
      },
      { root, threshold: [0.65, 0.8, 0.95] },
    )

    slides.forEach((slide) => observer.observe(slide))
    return () => observer.disconnect()
  }, [feed.length])

  useEffect(() => {
    // Close previous session
    const prev = sessionRef.current
    if (prev) {
      const listing = feed.find((l) => l.id === prev.listingId)
      flushWatch(prev, listing)
      sessionRef.current = null
    }

    videoRefs.current.forEach((video, index) => {
      if (!video) return
      if (index === activeIndex) {
        if (userInteracted) {
          video.muted = false
        }
        void video.play().catch(() => undefined)
      } else {
        video.pause()
        video.currentTime = 0
      }
    })

    const active = feed[activeIndex]
    if (active) {
      sessionRef.current = {
        listingId: active.id,
        watchMs: 0,
        durationMs: 0,
        completed: false,
      }
      lastTickRef.current = 0
    }
  }, [activeIndex, feed, userInteracted])

  const onTimeUpdate = (listingId: string, video: HTMLVideoElement) => {
    const session = sessionRef.current
    if (!session || session.listingId !== listingId) return
    const durationMs = (video.duration || 0) * 1000
    const currentMs = (video.currentTime || 0) * 1000
    session.durationMs = Math.max(session.durationMs, durationMs)

    if (currentMs >= lastTickRef.current) {
      session.watchMs += currentMs - lastTickRef.current
    }
    lastTickRef.current = currentMs

    if (durationMs > 0 && session.watchMs / durationMs >= 0.9) {
      session.completed = true
    }
  }

  if (loading || !statsReady) {
    return (
      <main className="page reels-page">
        <p className="reels-page__state">Reels betöltése…</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="page reels-page">
        <p className="reels-page__state form-error">{error}</p>
      </main>
    )
  }

  if (feed.length === 0) {
    return (
      <main className="page reels-page">
        <div className="reels-page__empty">
          <h1>Reels</h1>
          <p>Még nincs videós hirdetés. Tölts fel egyet, és megjelenik itt.</p>
          <Link to="/hirdetes-feladas" className="btn btn--accent btn--lg">
            Hirdetésfeladás
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="page reels-page">
      <div className="reels-scroller" ref={scrollerRef}>
        {feed.map((listing, index) => {
          const title = formatListingTitle(listing)
          return (
            <section
              key={listing.id}
              className="reel-slide"
              data-reel-index={index}
              aria-label={title}
            >
              <video
                ref={(el) => {
                  videoRefs.current[index] = el
                }}
                className="reel-slide__video"
                src={listing.videoUrl}
                poster={listing.videoPoster}
                playsInline
                muted={!userInteracted}
                loop
                autoPlay={index === activeIndex}
                preload={Math.abs(index - activeIndex) <= 1 ? 'auto' : 'metadata'}
                onClick={(e) => {
                  const video = e.currentTarget
                  if (video.paused) {
                    setUserInteracted(true)
                    video.muted = false
                    void video.play().catch(() => undefined)
                  }
                }}
                onTimeUpdate={(e) => onTimeUpdate(listing.id, e.currentTarget)}
                onEnded={(e) => {
                  const session = sessionRef.current
                  if (session?.listingId === listing.id) {
                    session.completed = true
                    session.watchMs = Math.max(
                      session.watchMs,
                      (e.currentTarget.duration || 0) * 1000,
                    )
                  }
                }}
                controls={false}
              />

              <div className="reel-slide__gradient" aria-hidden="true" />

              <div className="reel-slide__ui">
                <div className="reel-slide__meta">
                  <p className="reel-slide__eyebrow">
                    {listing.year} · {formatMileage(listing.mileage)} · {listing.location}
                  </p>
                  <h2 className="reel-slide__title">{title}</h2>
                  <p className="reel-slide__price">{formatPrice(listing.price)}</p>
                  <div className="reel-slide__seller">
                    <span>{listing.seller.name}</span>
                    <StatusBadge status={listing.seller.status} />
                  </div>
                </div>

                <div className="reel-slide__actions">
                  <Link to={listingPath(listing)} className="btn btn--accent btn--lg">
                    Hirdetés
                  </Link>
                  <button
                    type="button"
                    className="btn btn--outline btn--lg"
                    onClick={() => {
                      const video = videoRefs.current[index]
                      if (!video) return
                      video.muted = !video.muted
                      setUserInteracted(true)
                      if (!video.muted) void video.play().catch(() => undefined)
                    }}
                  >
                    {userInteracted && !videoRefs.current[index]?.muted ? 'Némítás' : 'Hang'}
                  </button>
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </main>
  )
}
