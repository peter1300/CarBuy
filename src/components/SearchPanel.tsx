import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CAR_MAKES, CAR_MAKES_MODELS } from '../data/carMakesModels'
import { HUNGARY_LOCATIONS } from '../data/hungaryLocations'
import {
  EMPTY_LISTING_SEARCH,
  listingSearchToQuery,
  type ListingSearchFilters,
} from '../lib/listingSearch'
import { useLocale } from '../i18n/LocaleContext'

type Props = {
  variant?: 'hero' | 'sidebar'
  initialFilters?: ListingSearchFilters
  listingCount?: number
}

export function SearchPanel({
  variant = 'hero',
  initialFilters = EMPTY_LISTING_SEARCH,
  listingCount,
}: Props) {
  const navigate = useNavigate()
  const { t, locale } = useLocale()
  const fuelAny = t('search.fuelAny')
  const [make, setMake] = useState(initialFilters.make)
  const [model, setModel] = useState(initialFilters.model)
  const [priceMin, setPriceMin] = useState(initialFilters.priceMin)
  const [priceMax, setPriceMax] = useState(initialFilters.priceMax)
  const [yearFrom, setYearFrom] = useState(initialFilters.yearFrom)
  const [yearTo, setYearTo] = useState(initialFilters.yearTo)
  const [powerMin, setPowerMin] = useState(initialFilters.powerMin)
  const [powerMax, setPowerMax] = useState(initialFilters.powerMax)
  const [mileageMin, setMileageMin] = useState(initialFilters.mileageMin)
  const [mileageMax, setMileageMax] = useState(initialFilters.mileageMax)
  const [fuel, setFuel] = useState(initialFilters.fuel || fuelAny)
  const [location, setLocation] = useState(initialFilters.location)

  const fuels = useMemo(
    () => [
      fuelAny,
      t('create.fuelPetrol'),
      t('create.fuelDiesel'),
      t('create.fuelHybrid'),
      t('create.fuelElectric'),
    ],
    [t, fuelAny],
  )

  useEffect(() => {
    setMake(initialFilters.make)
    setModel(initialFilters.model)
    setPriceMin(initialFilters.priceMin)
    setPriceMax(initialFilters.priceMax)
    setYearFrom(initialFilters.yearFrom)
    setYearTo(initialFilters.yearTo)
    setPowerMin(initialFilters.powerMin)
    setPowerMax(initialFilters.powerMax)
    setMileageMin(initialFilters.mileageMin)
    setMileageMax(initialFilters.mileageMax)
    setFuel(initialFilters.fuel || fuelAny)
    setLocation(initialFilters.location)
  }, [initialFilters, fuelAny])

  const models = useMemo(() => (make ? CAR_MAKES_MODELS[make] ?? [] : []), [make])

  const handleMakeChange = (value: string) => {
    setMake(value)
    setModel('')
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const filters: ListingSearchFilters = {
      q: initialFilters.q,
      make,
      model,
      priceMin,
      priceMax,
      yearFrom,
      yearTo,
      powerMin,
      powerMax,
      mileageMin,
      mileageMax,
      fuel: fuel === fuelAny ? '' : fuel,
      location,
    }
    navigate(`/hirdetesek${listingSearchToQuery(filters)}`)
  }

  const idPrefix = variant === 'sidebar' ? 'side-' : ''
  const metaCount =
    typeof listingCount === 'number'
      ? listingCount.toLocaleString(locale)
      : '2 847'

  return (
    <form
      className={`search-panel search-panel--${variant}`}
      id={variant === 'hero' ? 'kereses' : undefined}
      onSubmit={handleSubmit}
      aria-label={t('search.title')}
    >
      {variant === 'sidebar' && <h2 className="search-panel__heading">{t('search.filter')}</h2>}

      <div className="search-panel__rows">
        <div className="search-panel__row search-panel__row--primary">
          <div className="search-field">
            <label htmlFor={`${idPrefix}make`}>{t('search.make')}</label>
            <select
              id={`${idPrefix}make`}
              value={make}
              onChange={(e) => handleMakeChange(e.target.value)}
            >
              <option value="">{t('search.make')}</option>
              {CAR_MAKES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="search-field">
            <label htmlFor={`${idPrefix}model`}>{t('search.model')}</label>
            <select
              id={`${idPrefix}model`}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={!make}
            >
              <option value="">{make ? t('search.model') : t('search.any')}</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="search-field search-field--range">
            <span>{t('search.priceMin')} / {t('search.priceMax')}</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder={t('search.from')}
              aria-label={t('search.priceMin')}
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder={t('search.to')}
              aria-label={t('search.priceMax')}
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
            />
          </div>

          <div className="search-field">
            <label htmlFor={`${idPrefix}fuel`}>{t('search.fuel')}</label>
            <select
              id={`${idPrefix}fuel`}
              value={fuel}
              onChange={(e) => setFuel(e.target.value)}
            >
              {fuels.map((f) => (
                <option key={f} value={f} disabled={f === fuelAny}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="search-field">
            <label htmlFor={`${idPrefix}location`}>{t('search.location')}</label>
            <select
              id={`${idPrefix}location`}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            >
              <option value="">{t('search.location')}</option>
              {HUNGARY_LOCATIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="search-panel__row search-panel__row--ranges">
          <div className="search-field search-field--range">
            <span>{t('search.year')}</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder={t('search.from')}
              aria-label={t('search.yearMin')}
              min={1990}
              max={2026}
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value)}
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder={t('search.to')}
              aria-label={t('search.yearMax')}
              min={1990}
              max={2026}
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value)}
            />
          </div>

          <div className="search-field search-field--range">
            <span>{t('search.power')}</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder={t('search.from')}
              aria-label={t('search.power')}
              min={0}
              value={powerMin}
              onChange={(e) => setPowerMin(e.target.value)}
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder={t('search.to')}
              aria-label={t('search.power')}
              min={0}
              value={powerMax}
              onChange={(e) => setPowerMax(e.target.value)}
            />
          </div>

          <div className="search-field search-field--range">
            <span>{t('search.mileage')}</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder={t('search.from')}
              aria-label={t('search.mileage')}
              min={0}
              value={mileageMin}
              onChange={(e) => setMileageMin(e.target.value)}
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder={t('search.to')}
              aria-label={t('search.mileage')}
              min={0}
              value={mileageMax}
              onChange={(e) => setMileageMax(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="search-panel__actions">
        {variant === 'hero' && (
          <p className="search-panel__meta">
            {t('search.meta', { count: metaCount })}
          </p>
        )}
        <button type="submit" className="btn btn--accent btn--lg search-panel__submit">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M12.2 12.2L15.5 15.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          {t('search.submit')}
        </button>
      </div>
    </form>
  )
}
