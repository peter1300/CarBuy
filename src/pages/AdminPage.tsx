import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useListings } from '../context/ListingsContext'
import { formatListingTitle } from '../data/listings'
import { listingPath } from '../lib/listingUrl'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { ListingRow, ProfileRow } from '../lib/database.types'

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string | undefined
const DAILY_DAYS = 30

type AdminTab = 'overview' | 'users' | 'listings'

type DeletionStats = {
  total_deletions: number
  sold_carbuy: number
  sold_elsewhere: number
  not_sold: number
  carbuy_conversion_rate: number
}

type DailyStat = {
  day: string
  registrations: number
  listings_created: number
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

type UserEditForm = {
  name: string
  phone: string
  account_type: 'personal' | 'business'
  company_name: string
  seller_status: 'online' | 'busy' | 'offline'
}

type ListingEditForm = {
  title: string
  make: string
  model: string
  year: string
  price: string
  mileage: string
  fuel: string
  transmission: string
  power: string
  location: string
  description: string
}

function formatPrice(price: number | null) {
  if (price == null) return '—'
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency: 'HUF',
    maximumFractionDigits: 0,
  }).format(price)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDayLabel(day: string) {
  return new Date(day + 'T12:00:00').toLocaleDateString('hu-HU', {
    month: 'short',
    day: 'numeric',
  })
}

function getReasonLabel(reason: string) {
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

export function AdminPage() {
  const { user, loading: authLoading } = useAuth()
  const { refreshListings } = useListings()
  const [tab, setTab] = useState<AdminTab>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionOk, setActionOk] = useState<string | null>(null)

  const [deletionStats, setDeletionStats] = useState<DeletionStats | null>(null)
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([])
  const [recentDeletions, setRecentDeletions] = useState<RecentDeletion[]>([])
  const [users, setUsers] = useState<ProfileRow[]>([])
  const [listings, setListings] = useState<ListingRow[]>([])

  const [editingUser, setEditingUser] = useState<ProfileRow | null>(null)
  const [userForm, setUserForm] = useState<UserEditForm | null>(null)
  const [savingUser, setSavingUser] = useState(false)

  const [editingListing, setEditingListing] = useState<ListingRow | null>(null)
  const [listingForm, setListingForm] = useState<ListingEditForm | null>(null)
  const [savingListing, setSavingListing] = useState(false)

  const isAdmin =
    !!user?.email && !!ADMIN_EMAIL && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()

  const loadData = async () => {
    setLoading(true)
    setError(null)

    try {
      const [statsRes, dailyRes, deletionsRes, usersRes, listingsRes] = await Promise.all([
        supabase.rpc('get_deletion_stats'),
        supabase.rpc('get_daily_activity_stats', { p_days: DAILY_DAYS }),
        supabase
          .from('listing_deletions')
          .select('id, listing_title, listing_make, listing_model, listing_price, reason, created_at')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('listings')
          .select('*')
          .eq('is_demo', false)
          .order('created_at', { ascending: false })
          .limit(200),
      ])

      if (statsRes.error) throw new Error(statsRes.error.message)
      if (dailyRes.error) throw new Error(dailyRes.error.message)
      if (deletionsRes.error) throw new Error(deletionsRes.error.message)
      if (usersRes.error) throw new Error(usersRes.error.message)
      if (listingsRes.error) throw new Error(listingsRes.error.message)

      if (statsRes.data && statsRes.data.length > 0) {
        setDeletionStats(statsRes.data[0] as DeletionStats)
      } else {
        setDeletionStats({
          total_deletions: 0,
          sold_carbuy: 0,
          sold_elsewhere: 0,
          not_sold: 0,
          carbuy_conversion_rate: 0,
        })
      }

      setDailyStats((dailyRes.data ?? []) as DailyStat[])
      setRecentDeletions((deletionsRes.data ?? []) as RecentDeletion[])
      setUsers((usersRes.data ?? []) as ProfileRow[])
      setListings((listingsRes.data ?? []) as ListingRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAdmin || !isSupabaseConfigured) return
    void loadData()
  }, [isAdmin])

  const openUserEdit = (profile: ProfileRow) => {
    setActionError(null)
    setActionOk(null)
    setEditingUser(profile)
    setUserForm({
      name: profile.name,
      phone: profile.phone ?? '',
      account_type: profile.account_type,
      company_name: profile.company_name ?? '',
      seller_status: profile.seller_status,
    })
  }

  const saveUser = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingUser || !userForm) return
    setSavingUser(true)
    setActionError(null)
    setActionOk(null)

    try {
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({
          name: userForm.name.trim(),
          phone: userForm.phone.trim() || null,
          account_type: userForm.account_type,
          company_name:
            userForm.account_type === 'business' ? userForm.company_name.trim() || null : null,
          seller_status: userForm.seller_status,
        })
        .eq('id', editingUser.id)
        .select()
        .single()

      if (updateError) throw new Error(updateError.message)
      setUsers((prev) => prev.map((u) => (u.id === data.id ? (data as ProfileRow) : u)))
      setEditingUser(null)
      setUserForm(null)
      setActionOk('Felhasználó mentve.')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Mentés sikertelen')
    } finally {
      setSavingUser(false)
    }
  }

  const openListingEdit = (listing: ListingRow) => {
    setActionError(null)
    setActionOk(null)
    setEditingListing(listing)
    setListingForm({
      title: listing.title,
      make: listing.make,
      model: listing.model,
      year: String(listing.year),
      price: String(listing.price),
      mileage: String(listing.mileage),
      fuel: listing.fuel,
      transmission: listing.transmission,
      power: String(listing.power),
      location: listing.location,
      description: listing.description,
    })
  }

  const saveListing = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingListing || !listingForm) return
    setSavingListing(true)
    setActionError(null)
    setActionOk(null)

    try {
      const year = Number(listingForm.year)
      const price = Number(listingForm.price)
      const mileage = Number(listingForm.mileage)
      const power = Number(listingForm.power)
      if (!Number.isFinite(year) || !Number.isFinite(price) || !Number.isFinite(mileage) || !Number.isFinite(power)) {
        throw new Error('Év, ár, km és teljesítmény szám legyen.')
      }

      const { data, error: updateError } = await supabase
        .from('listings')
        .update({
          title: listingForm.title.trim(),
          make: listingForm.make.trim(),
          model: listingForm.model.trim(),
          year,
          price,
          mileage,
          fuel: listingForm.fuel.trim(),
          transmission: listingForm.transmission.trim(),
          power,
          location: listingForm.location.trim(),
          description: listingForm.description.trim(),
        })
        .eq('id', editingListing.id)
        .select()
        .single()

      if (updateError) throw new Error(updateError.message)
      setListings((prev) => prev.map((l) => (l.id === data.id ? (data as ListingRow) : l)))
      setEditingListing(null)
      setListingForm(null)
      setActionOk('Hirdetés mentve.')
      void refreshListings()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Mentés sikertelen')
    } finally {
      setSavingListing(false)
    }
  }

  const deleteListing = async (listing: ListingRow) => {
    if (!window.confirm(`Törölöd ezt a hirdetést?\n${formatListingTitle(listing)}`)) return
    setActionError(null)
    setActionOk(null)
    try {
      const { error: deleteError } = await supabase.from('listings').delete().eq('id', listing.id)
      if (deleteError) throw new Error(deleteError.message)
      setListings((prev) => prev.filter((l) => l.id !== listing.id))
      if (editingListing?.id === listing.id) {
        setEditingListing(null)
        setListingForm(null)
      }
      setActionOk('Hirdetés törölve.')
      void refreshListings()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Törlés sikertelen')
    }
  }

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

  const maxDaily = Math.max(
    1,
    ...dailyStats.map((d) => Math.max(d.registrations, d.listings_created)),
  )
  const totalRegs = dailyStats.reduce((sum, d) => sum + Number(d.registrations), 0)
  const totalListingsPeriod = dailyStats.reduce((sum, d) => sum + Number(d.listings_created), 0)
  const maxBarValue = deletionStats
    ? Math.max(deletionStats.sold_carbuy, deletionStats.sold_elsewhere, deletionStats.not_sold, 1)
    : 1

  return (
    <main className="page admin-page">
      <div className="container">
        <div className="admin-header">
          <h1>Admin Dashboard</h1>
          <p>Napi aktivitás, felhasználók, hirdetések és törlési statisztikák</p>
        </div>

        <div className="admin-tabs" role="tablist" aria-label="Admin szekciók">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'overview'}
            className={`admin-tab${tab === 'overview' ? ' is-active' : ''}`}
            onClick={() => setTab('overview')}
          >
            Áttekintés
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'users'}
            className={`admin-tab${tab === 'users' ? ' is-active' : ''}`}
            onClick={() => setTab('users')}
          >
            Felhasználók ({users.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'listings'}
            className={`admin-tab${tab === 'listings' ? ' is-active' : ''}`}
            onClick={() => setTab('listings')}
          >
            Hirdetések ({listings.length})
          </button>
        </div>

        {error && <p className="form-error">{error}</p>}
        {actionError && <p className="form-error">{actionError}</p>}
        {actionOk && <p className="admin-ok">{actionOk}</p>}

        {loading ? (
          <p className="state-message">Adatok betöltése…</p>
        ) : (
          <>
            {tab === 'overview' && (
              <>
                <div className="admin-stats">
                  <div className="admin-stat-card">
                    <span className="admin-stat-card__value">{users.length}</span>
                    <span className="admin-stat-card__label">Felhasználók</span>
                  </div>
                  <div className="admin-stat-card">
                    <span className="admin-stat-card__value">{listings.length}</span>
                    <span className="admin-stat-card__label">Aktív hirdetések</span>
                  </div>
                  <div className="admin-stat-card">
                    <span className="admin-stat-card__value admin-stat-card__value--accent">
                      {totalRegs}
                    </span>
                    <span className="admin-stat-card__label">Regisztráció ({DAILY_DAYS} nap)</span>
                  </div>
                  <div className="admin-stat-card">
                    <span className="admin-stat-card__value admin-stat-card__value--success">
                      {totalListingsPeriod}
                    </span>
                    <span className="admin-stat-card__label">Új hirdetés ({DAILY_DAYS} nap)</span>
                  </div>
                </div>

                <div className="admin-section">
                  <h2>Napi aktivitás — utolsó {DAILY_DAYS} nap</h2>
                  <div className="admin-legend">
                    <span className="admin-legend__item admin-legend__item--reg">Regisztráció</span>
                    <span className="admin-legend__item admin-legend__item--lis">Hirdetés</span>
                  </div>
                  {dailyStats.length === 0 ? (
                    <p className="state-message">Nincs napi adat. Futtasd a 012_admin_panel.sql migrációt.</p>
                  ) : (
                    <div className="admin-daily-chart" role="img" aria-label="Napi regisztrációk és hirdetések">
                      {dailyStats.map((d) => (
                        <div key={d.day} className="admin-daily-chart__col" title={`${d.day}: ${d.registrations} reg, ${d.listings_created} hirdetés`}>
                          <div className="admin-daily-chart__bars">
                            <div
                              className="admin-daily-chart__bar admin-daily-chart__bar--reg"
                              style={{
                                height: `${(Number(d.registrations) / maxDaily) * 140}px`,
                              }}
                            />
                            <div
                              className="admin-daily-chart__bar admin-daily-chart__bar--lis"
                              style={{
                                height: `${(Number(d.listings_created) / maxDaily) * 140}px`,
                              }}
                            />
                          </div>
                          <span className="admin-daily-chart__label">{formatDayLabel(d.day)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {deletionStats && (
                  <>
                    <div className="admin-stats" style={{ marginTop: '1.5rem' }}>
                      <div className="admin-stat-card">
                        <span className="admin-stat-card__value">{deletionStats.total_deletions}</span>
                        <span className="admin-stat-card__label">Összes törlés</span>
                      </div>
                      <div className="admin-stat-card">
                        <span className="admin-stat-card__value admin-stat-card__value--success">
                          {deletionStats.sold_carbuy}
                        </span>
                        <span className="admin-stat-card__label">CarBuy-on eladva</span>
                      </div>
                      <div className="admin-stat-card">
                        <span className="admin-stat-card__value admin-stat-card__value--warning">
                          {deletionStats.sold_elsewhere}
                        </span>
                        <span className="admin-stat-card__label">Máshol eladva</span>
                      </div>
                      <div className="admin-stat-card">
                        <span className="admin-stat-card__value admin-stat-card__value--accent">
                          {deletionStats.carbuy_conversion_rate}%
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
                            style={{
                              height: `${(deletionStats.sold_carbuy / maxBarValue) * 160}px`,
                            }}
                          />
                          <span className="admin-chart__value">{deletionStats.sold_carbuy}</span>
                          <span className="admin-chart__label">CarBuy</span>
                        </div>
                        <div className="admin-chart__bar">
                          <div
                            className="admin-chart__fill admin-chart__fill--elsewhere"
                            style={{
                              height: `${(deletionStats.sold_elsewhere / maxBarValue) * 160}px`,
                            }}
                          />
                          <span className="admin-chart__value">{deletionStats.sold_elsewhere}</span>
                          <span className="admin-chart__label">Máshol</span>
                        </div>
                        <div className="admin-chart__bar">
                          <div
                            className="admin-chart__fill admin-chart__fill--notsold"
                            style={{
                              height: `${(deletionStats.not_sold / maxBarValue) * 160}px`,
                            }}
                          />
                          <span className="admin-chart__value">{deletionStats.not_sold}</span>
                          <span className="admin-chart__label">Nem eladva</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {recentDeletions.length > 0 && (
                  <div className="admin-section" style={{ marginTop: '1.5rem' }}>
                    <h2>Legutóbbi törlések</h2>
                    <div className="admin-table-wrap">
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
                                {d.listing_title ||
                                  `${d.listing_make || ''} ${d.listing_model || ''}`.trim() ||
                                  '—'}
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
                  </div>
                )}
              </>
            )}

            {tab === 'users' && (
              <div className="admin-section">
                <h2>Regisztrált felhasználók</h2>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Név</th>
                        <th>Email</th>
                        <th>Típus</th>
                        <th>Telefon</th>
                        <th>Regisztráció</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td>{u.name}</td>
                          <td>{u.email}</td>
                          <td>{u.account_type === 'business' ? 'Céges' : 'Magán'}</td>
                          <td>{u.phone || '—'}</td>
                          <td>{formatDate(u.created_at)}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => openUserEdit(u)}
                            >
                              Szerkesztés
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'listings' && (
              <div className="admin-section">
                <h2>Hirdetések</h2>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Hirdetés</th>
                        <th>Ár</th>
                        <th>Helyszín</th>
                        <th>Eladó</th>
                        <th>Létrehozva</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {listings.map((l) => (
                        <tr key={l.id}>
                          <td>
                            <Link to={listingPath(l)} className="admin-link">
                              {formatListingTitle(l)}
                            </Link>
                          </td>
                          <td>{formatPrice(l.price)}</td>
                          <td>{l.location || '—'}</td>
                          <td>{l.seller_name}</td>
                          <td>{formatDate(l.created_at)}</td>
                          <td className="admin-row-actions">
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => openListingEdit(l)}
                            >
                              Szerkesztés
                            </button>
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm admin-btn-danger"
                              onClick={() => void deleteListing(l)}
                            >
                              Törlés
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {editingUser && userForm && (
        <div
          className="dialog-overlay"
          role="presentation"
          onClick={() => {
            setEditingUser(null)
            setUserForm(null)
          }}
        >
          <form
            className="dialog admin-edit-dialog"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void saveUser(e)}
          >
            <h2 className="dialog__title">Felhasználó szerkesztése</h2>
            <p className="dialog__text">{editingUser.email}</p>

            <label className="admin-field">
              <span>Név</span>
              <input
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                required
              />
            </label>
            <label className="admin-field">
              <span>Telefon</span>
              <input
                value={userForm.phone}
                onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
              />
            </label>
            <label className="admin-field">
              <span>Fióktípus</span>
              <select
                value={userForm.account_type}
                onChange={(e) =>
                  setUserForm({
                    ...userForm,
                    account_type: e.target.value as 'personal' | 'business',
                  })
                }
              >
                <option value="personal">Magán</option>
                <option value="business">Céges</option>
              </select>
            </label>
            {userForm.account_type === 'business' && (
              <label className="admin-field">
                <span>Cégnév</span>
                <input
                  value={userForm.company_name}
                  onChange={(e) => setUserForm({ ...userForm, company_name: e.target.value })}
                />
              </label>
            )}
            <label className="admin-field">
              <span>Eladói státusz</span>
              <select
                value={userForm.seller_status}
                onChange={(e) =>
                  setUserForm({
                    ...userForm,
                    seller_status: e.target.value as 'online' | 'busy' | 'offline',
                  })
                }
              >
                <option value="online">Online</option>
                <option value="busy">Elfoglalt</option>
                <option value="offline">Offline</option>
              </select>
            </label>

            <div className="dialog__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setEditingUser(null)
                  setUserForm(null)
                }}
              >
                Mégse
              </button>
              <button type="submit" className="btn btn--primary" disabled={savingUser}>
                {savingUser ? 'Mentés…' : 'Mentés'}
              </button>
            </div>
          </form>
        </div>
      )}

      {editingListing && listingForm && (
        <div
          className="dialog-overlay"
          role="presentation"
          onClick={() => {
            setEditingListing(null)
            setListingForm(null)
          }}
        >
          <form
            className="dialog admin-edit-dialog admin-edit-dialog--wide"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void saveListing(e)}
          >
            <h2 className="dialog__title">Hirdetés szerkesztése</h2>

            <div className="admin-edit-grid">
              <label className="admin-field">
                <span>Cím</span>
                <input
                  value={listingForm.title}
                  onChange={(e) => setListingForm({ ...listingForm, title: e.target.value })}
                  required
                />
              </label>
              <label className="admin-field">
                <span>Márka</span>
                <input
                  value={listingForm.make}
                  onChange={(e) => setListingForm({ ...listingForm, make: e.target.value })}
                  required
                />
              </label>
              <label className="admin-field">
                <span>Modell</span>
                <input
                  value={listingForm.model}
                  onChange={(e) => setListingForm({ ...listingForm, model: e.target.value })}
                  required
                />
              </label>
              <label className="admin-field">
                <span>Évjárat</span>
                <input
                  type="number"
                  value={listingForm.year}
                  onChange={(e) => setListingForm({ ...listingForm, year: e.target.value })}
                  required
                />
              </label>
              <label className="admin-field">
                <span>Ár (Ft)</span>
                <input
                  type="number"
                  value={listingForm.price}
                  onChange={(e) => setListingForm({ ...listingForm, price: e.target.value })}
                  required
                />
              </label>
              <label className="admin-field">
                <span>Km</span>
                <input
                  type="number"
                  value={listingForm.mileage}
                  onChange={(e) => setListingForm({ ...listingForm, mileage: e.target.value })}
                  required
                />
              </label>
              <label className="admin-field">
                <span>Üzemanyag</span>
                <input
                  value={listingForm.fuel}
                  onChange={(e) => setListingForm({ ...listingForm, fuel: e.target.value })}
                />
              </label>
              <label className="admin-field">
                <span>Váltó</span>
                <input
                  value={listingForm.transmission}
                  onChange={(e) => setListingForm({ ...listingForm, transmission: e.target.value })}
                />
              </label>
              <label className="admin-field">
                <span>Teljesítmény (LE)</span>
                <input
                  type="number"
                  value={listingForm.power}
                  onChange={(e) => setListingForm({ ...listingForm, power: e.target.value })}
                />
              </label>
              <label className="admin-field">
                <span>Helyszín</span>
                <input
                  value={listingForm.location}
                  onChange={(e) => setListingForm({ ...listingForm, location: e.target.value })}
                />
              </label>
            </div>
            <label className="admin-field">
              <span>Leírás</span>
              <textarea
                rows={4}
                value={listingForm.description}
                onChange={(e) => setListingForm({ ...listingForm, description: e.target.value })}
              />
            </label>

            <div className="dialog__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setEditingListing(null)
                  setListingForm(null)
                }}
              >
                Mégse
              </button>
              <button type="submit" className="btn btn--primary" disabled={savingListing}>
                {savingListing ? 'Mentés…' : 'Mentés'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
