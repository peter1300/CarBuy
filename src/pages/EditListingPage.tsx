import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useListings } from '../context/ListingsContext'
import { HUNGARY_LOCATIONS } from '../data/hungaryLocations'
import { formatListingTitle } from '../data/listings'
import { useLocale } from '../i18n/LocaleContext'
import { COUNTRY_LABELS, type MarketCountry } from '../i18n/locales'
import {
  LISTING_IMAGE_ACCEPT,
  MAX_LISTING_IMAGES,
  validateListingImageFile,
} from '../lib/listingImages'
import { mapListingRow } from '../lib/mapListing'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Listing, SellerStatus } from '../data/listings'

export function EditListingPage() {
  const { id } = useParams<{ id: string }>()
  const { user, loading: authLoading } = useAuth()
  const { updateListing } = useListings()
  const { t } = useLocale()

  const [listing, setListing] = useState<Listing | null>(null)
  const [loadingListing, setLoadingListing] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [year, setYear] = useState('')
  const [mileage, setMileage] = useState('')
  const [fuel, setFuel] = useState('')
  const [transmission, setTransmission] = useState('')
  const [power, setPower] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [sellerStatus, setSellerStatus] = useState<SellerStatus>('offline')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [newImageFiles, setNewImageFiles] = useState<File[]>([])
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([])
  const [imageError, setImageError] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!id || !user || !isSupabaseConfigured) {
      setListing(null)
      setLoadingListing(false)
      return
    }

    let cancelled = false
    setLoadingListing(true)
    setLoadError(null)

    void (async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .eq('owner_id', user.id)
        .maybeSingle()

      if (cancelled) return

      if (error || !data) {
        setListing(null)
        setLoadError(error?.message ?? t('editListing.notFound'))
        setLoadingListing(false)
        return
      }

      const mapped = mapListingRow(data)
      setListing(mapped)
      setTitle(mapped.title)
      setYear(String(mapped.year))
      setMileage(String(mapped.mileage))
      setFuel(mapped.fuel)
      setTransmission(mapped.transmission)
      setPower(String(mapped.power || ''))
      setLocation(mapped.location)
      setDescription(mapped.description)
      setPrice(String(mapped.price))
      setSellerStatus(mapped.seller.status)
      setImageUrls(mapped.imageUrls ?? [])
      setNewImageFiles([])
      setLoadingListing(false)
    })()

    return () => {
      cancelled = true
    }
  }, [id, user, t])

  useEffect(() => {
    const urls = newImageFiles.map((file) => URL.createObjectURL(file))
    setNewImagePreviews(urls)
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [newImageFiles])

  if (authLoading || loadingListing) {
    return (
      <main className="page account-page">
        <div className="container">
          <p className="state-message">{t('common.loading')}</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/belepes" replace />
  }

  if (!listing) {
    return (
      <main className="page account-page">
        <div className="container account-page__narrow">
          <Link to="/profil" className="product__back">
            {t('editListing.back')}
          </Link>
          <p className="form-error">{loadError ?? t('editListing.notFound')}</p>
        </div>
      </main>
    )
  }

  const listingCountry = (listing.country ?? 'HU') as MarketCountry

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setFormError(null)
    setSaved(false)
    setSubmitting(true)

    try {
      await updateListing(user, listing.id, {
        title: title.trim() || `${listing.make} ${listing.model}`.trim(),
        year: Number(year) || listing.year,
        price: Number(price) || 0,
        mileage: Number(mileage) || 0,
        fuel: fuel || '—',
        transmission: transmission || '—',
        power: Number(power) || 0,
        location: location || '—',
        description,
        status: sellerStatus,
        imageUrls,
        imageFiles: newImageFiles,
      }).then((updated) => {
        setListing(updated)
        setImageUrls(updated.imageUrls ?? [])
        setNewImageFiles([])
      })
      setSaved(true)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('errors.generic'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="page account-page">
      <div className="container account-page__narrow account-page__form">
        <Link to="/profil" className="product__back">
          {t('editListing.back')}
        </Link>
        <header className="account-page__header">
          <h1>{t('editListing.title')}</h1>
          <p>{t('editListing.sub')}</p>
          <p className="account-page__listing-title">{formatListingTitle(listing)}</p>
        </header>

        <form className="account-card" onSubmit={handleSubmit}>
          <p className="form-hint form-hint--locked">{t('editListing.lockedHint')}</p>

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="edit-category">{t('editListing.category')}</label>
              <input id="edit-category" value={t('product.category')} readOnly disabled className="is-locked" />
            </div>
            <div className="form-field">
              <label htmlFor="edit-make">{t('create.make')}</label>
              <input id="edit-make" value={listing.make} readOnly disabled className="is-locked" />
            </div>
            <div className="form-field">
              <label htmlFor="edit-model">{t('create.model')}</label>
              <input id="edit-model" value={listing.model} readOnly disabled className="is-locked" />
            </div>
            <div className="form-field">
              <label htmlFor="edit-country">{t('create.country')}</label>
              <input
                id="edit-country"
                value={COUNTRY_LABELS[listingCountry]}
                readOnly
                disabled
                className="is-locked"
              />
            </div>

            <div className="form-field form-field--full">
              <label htmlFor="edit-title">{t('create.title')}</label>
              <input
                id="edit-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="edit-year">{t('create.year')}</label>
              <input
                id="edit-year"
                type="number"
                required
                min={1990}
                max={2026}
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="edit-mileage">{t('create.mileage')}</label>
              <input
                id="edit-mileage"
                type="number"
                required
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="edit-fuel">{t('create.fuel')}</label>
              <select id="edit-fuel" required value={fuel} onChange={(e) => setFuel(e.target.value)}>
                <option value="" disabled>
                  —
                </option>
                <option value={t('create.fuelPetrol')}>{t('create.fuelPetrol')}</option>
                <option value={t('create.fuelDiesel')}>{t('create.fuelDiesel')}</option>
                <option value={t('create.fuelHybrid')}>{t('create.fuelHybrid')}</option>
                <option value={t('create.fuelElectric')}>{t('create.fuelElectric')}</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="edit-transmission">{t('create.transmission')}</label>
              <select
                id="edit-transmission"
                required
                value={transmission}
                onChange={(e) => setTransmission(e.target.value)}
              >
                <option value="" disabled>
                  —
                </option>
                <option value={t('create.transManual')}>{t('create.transManual')}</option>
                <option value={t('create.transAuto')}>{t('create.transAuto')}</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="edit-power">{t('create.power')}</label>
              <input
                id="edit-power"
                type="number"
                value={power}
                onChange={(e) => setPower(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="edit-location">{t('create.location')}</label>
              {listingCountry === 'HU' ? (
                <select
                  id="edit-location"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                >
                  <option value="" disabled>
                    —
                  </option>
                  {HUNGARY_LOCATIONS.filter((entry) => entry !== 'Teljes Magyarország').map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="edit-location"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              )}
            </div>
            <div className="form-field form-field--full">
              <label htmlFor="edit-price">{t('create.price')}</label>
              <input
                id="edit-price"
                type="number"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="input-price"
              />
            </div>
            <div className="form-field form-field--full">
              <label htmlFor="edit-description">{t('create.description')}</label>
              <textarea
                id="edit-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="form-field form-field--full">
            <label>{t('editListing.photos')}</label>
            <p className="form-hint">{t('editListing.photosHint', { max: MAX_LISTING_IMAGES })}</p>
            <input
              ref={imageInputRef}
              type="file"
              accept={LISTING_IMAGE_ACCEPT}
              multiple
              hidden
              onChange={(e) => {
                setImageError(null)
                const files = e.target.files
                if (!files || files.length === 0) return
                const next = [...newImageFiles]
                for (const file of Array.from(files)) {
                  if (imageUrls.length + next.length >= MAX_LISTING_IMAGES) {
                    setImageError(t('errors.listingImageCount', { max: MAX_LISTING_IMAGES }))
                    break
                  }
                  const err = validateListingImageFile(file)
                  if (err) {
                    setImageError(err)
                    continue
                  }
                  next.push(file)
                }
                setNewImageFiles(next)
                e.target.value = ''
              }}
            />
            <div className="listing-image-grid">
              {imageUrls.map((url) => (
                <div className="listing-image-grid__item" key={url}>
                  <img src={url} alt="" />
                  <button
                    type="button"
                    className="listing-image-grid__remove"
                    onClick={() => setImageUrls((prev) => prev.filter((item) => item !== url))}
                    aria-label={t('create.imagesRemove')}
                  >
                    ×
                  </button>
                </div>
              ))}
              {newImagePreviews.map((url, index) => (
                <div className="listing-image-grid__item" key={`new-${url}-${index}`}>
                  <img src={url} alt="" />
                  <button
                    type="button"
                    className="listing-image-grid__remove"
                    onClick={() =>
                      setNewImageFiles((prev) => prev.filter((_, i) => i !== index))
                    }
                    aria-label={t('create.imagesRemove')}
                  >
                    ×
                  </button>
                </div>
              ))}
              {imageUrls.length + newImageFiles.length < MAX_LISTING_IMAGES && (
                <button
                  type="button"
                  className="listing-image-grid__add"
                  onClick={() => imageInputRef.current?.click()}
                >
                  {t('create.imagesAdd')}
                </button>
              )}
            </div>
            {imageError && <p className="form-error">{imageError}</p>}
          </div>

          <div className="form-field">
            <label htmlFor="edit-status">{t('editListing.status')}</label>
            <select
              id="edit-status"
              value={sellerStatus}
              onChange={(e) => setSellerStatus(e.target.value as SellerStatus)}
            >
              <option value="online">{t('status.online')}</option>
              <option value="busy">{t('status.busy')}</option>
              <option value="offline">{t('status.offline')}</option>
            </select>
          </div>

          {formError && <p className="form-error">{formError}</p>}
          {saved && <p className="account-card__success">{t('editListing.saved')}</p>}

          <div className="account-card__actions">
            <button type="submit" className="btn btn--accent btn--lg" disabled={submitting}>
              {submitting ? t('editListing.saving') : t('editListing.save')}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
