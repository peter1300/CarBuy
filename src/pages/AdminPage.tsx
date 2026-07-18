import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string | undefined

type DeletionStats = {
  total_deletions: number
  sold_carbuy: number
  sold_elsewhere: number
  not_sold: number
  carbuy_conversion_rate: number
}

type RecentDeletion = {
  id: string
  listing_title: string | null
  listing_make: string | null
  listing_model: string | null
  listing_price: number | null
  reason: string
  created_at: string
}

export function AdminPage() {
  const { user, loading: authLoading } = useAuth()
  const [stats, setStats] = useState<DeletionStats | null>(null)
  const [recentDeletions, setRecentDeletions] = useState<RecentDeletion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = user?.email && ADMIN_EMAIL && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()

  useEffect(() => {
    if (!isAdmin || !isSupabaseConfigured) return

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        const { data: statsData, error: statsError } = await supabase.rpc('get_deletion_stats')
        if (statsError) throw new Error(statsError.message)
        if (statsData && statsData.length > 0) {
          setStats(statsData[0] as DeletionStats)
        }

        const { data: deletionsData, error: deletionsError } = await supabase
          .from('listing_deletions')
          .select('id, listing_title, listing_make, listing_model, listing_price, reason, created_at')
          .order('created_at', { ascending: false })
          .limit(20)
        if (deletionsError) throw new Error(deletionsError.message)
        setRecentDeletions(deletionsData as RecentDeletion[])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Hiba történt')
      } finally {
        setLoading(false)
      }
    }

    void fetchData()
  }, [isAdmin])

  if (authLoading) {
    return (
      <main className="page admin-page">
        <div className="container">
          <p className="state-message">Betöltés…</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/belepes" replace />
  }

  if (!isAdmin) {
    return (
      <main className="page admin-page">
        <div className="container">
          <div className="admin-header">
            <h1>Hozzáférés megtagadva</h1>
            <p>Nincs jogosultságod az admin felület megtekintéséhez.</p>
          </div>
        </div>
      </main>
    )
  }

  const formatPrice = (price: number | null) => {
    if (!price) return '—'
    return new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(price)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'sold_carbuy':
        return 'CarBuy-on eladva'
      case 'sold_elsewhere':
        return 'Máshol eladva'
      case 'not_sold':
        return 'Nem eladva'
      default:
        return reason
    }
  }

  const maxBarValue = stats
    ? Math.max(stats.sold_carbuy, stats.sold_elsewhere, stats.not_sold, 1)
    : 1

  return (
    <main className="page admin-page">
      <div className="container">
        <div className="admin-header">
          <h1>Admin Dashboard</h1>
          <p>Hirdetés törlési statisztikák és konverziók</p>
        </div>

        {error && <p className="form-error">{error}</p>}

        {loading ? (
          <p className="state-message">Statisztikák betöltése…</p>
        ) : stats ? (
          <>
            <div className="admin-stats">
              <div className="admin-stat-card">
                <span className="admin-stat-card__value">{stats.total_deletions}</span>
                <span className="admin-stat-card__label">Összes törlés</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-card__value admin-stat-card__value--success">
                  {stats.sold_carbuy}
                </span>
                <span className="admin-stat-card__label">CarBuy-on eladva</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-card__value admin-stat-card__value--warning">
                  {stats.sold_elsewhere}
                </span>
                <span className="admin-stat-card__label">Máshol eladva</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-card__value admin-stat-card__value--accent">
                  {stats.carbuy_conversion_rate}%
                </span>
                <span className="admin-stat-card__label">CarBuy konverzió</span>
              </div>
            </div>

            <div className="admin-section">
              <h2>Eladási statisztikák</h2>
              <div className="admin-chart">
                <div className="admin-chart__bar">
                  <div
                    className="admin-chart__fill admin-chart__fill--carbuy"
                    style={{ height: `${(stats.sold_carbuy / maxBarValue) * 160}px` }}
                  />
                  <span className="admin-chart__value">{stats.sold_carbuy}</span>
                  <span className="admin-chart__label">CarBuy</span>
                </div>
                <div className="admin-chart__bar">
                  <div
                    className="admin-chart__fill admin-chart__fill--elsewhere"
                    style={{ height: `${(stats.sold_elsewhere / maxBarValue) * 160}px` }}
                  />
                  <span className="admin-chart__value">{stats.sold_elsewhere}</span>
                  <span className="admin-chart__label">Máshol</span>
                </div>
                <div className="admin-chart__bar">
                  <div
                    className="admin-chart__fill admin-chart__fill--notsold"
                    style={{ height: `${(stats.not_sold / maxBarValue) * 160}px` }}
                  />
                  <span className="admin-chart__value">{stats.not_sold}</span>
                  <span className="admin-chart__label">Nem eladva</span>
                </div>
              </div>
            </div>

            {recentDeletions.length > 0 && (
              <div className="admin-section" style={{ marginTop: '1.5rem' }}>
                <h2>Legutóbbi törlések</h2>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Hirdetés</th>
                      <th>Ár</th>
                      <th>Ok</th>
                      <th>Dátum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentDeletions.map((d) => (
                      <tr key={d.id}>
                        <td>
                          {d.listing_title || `${d.listing_make || ''} ${d.listing_model || ''}`.trim() || '—'}
                        </td>
                        <td>{formatPrice(d.listing_price)}</td>
                        <td>
                          <span className={`admin-reason admin-reason--${d.reason}`}>
                            {getReasonLabel(d.reason)}
                          </span>
                        </td>
                        <td>{formatDate(d.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="state-message">Még nincs törlési adat.</p>
        )}
      </div>
    </main>
  )
}
