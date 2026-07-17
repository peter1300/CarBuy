import { useMemo, useState, type FormEvent } from 'react'
import { CAR_MAKES, CAR_MAKES_MODELS } from '../data/carMakesModels'
import { HUNGARY_LOCATIONS } from '../data/hungaryLocations'

const fuels = ['Üzemanyag', 'Benzin', 'Dízel', 'Hibrid', 'Elektromos']

export function SearchPanel() {
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')
  const [powerMin, setPowerMin] = useState('')
  const [powerMax, setPowerMax] = useState('')
  const [mileageMin, setMileageMin] = useState('')
  const [mileageMax, setMileageMax] = useState('')
  const [fuel, setFuel] = useState('Üzemanyag')
  const [location, setLocation] = useState('')

  const models = useMemo(() => (make ? CAR_MAKES_MODELS[make] ?? [] : []), [make])

  const handleMakeChange = (value: string) => {
    setMake(value)
    setModel('')
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const el = document.getElementById('hirdetesek')
    el?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <form className="search-panel" id="kereses" onSubmit={handleSubmit} aria-label="Autókereső">
      <div className="search-panel__rows">
        <div className="search-panel__row search-panel__row--primary">
          <div className="search-field">
            <label htmlFor="make">Márka</label>
            <select id="make" value={make} onChange={(e) => handleMakeChange(e.target.value)}>
              <option value="">Márka</option>
              {CAR_MAKES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="search-field">
            <label htmlFor="model">Modell</label>
            <select
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={!make}
            >
              <option value="">{make ? 'Modell' : 'Előbb válassz márkát'}</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="search-field search-field--range">
            <span>Ár (Ft)</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="Tól"
              aria-label="Minimum ár"
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder="Ig"
              aria-label="Maximum ár"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
            />
          </div>

          <div className="search-field">
            <label htmlFor="fuel">Üzemanyag</label>
            <select id="fuel" value={fuel} onChange={(e) => setFuel(e.target.value)}>
              {fuels.map((f) => (
                <option key={f} value={f} disabled={f === 'Üzemanyag'}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="search-field">
            <label htmlFor="location">Helyszín</label>
            <select id="location" value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">Helyszín</option>
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
            <span>Évjárat</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="Tól"
              aria-label="Évjárat tól"
              min={1990}
              max={2026}
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value)}
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder="Ig"
              aria-label="Évjárat ig"
              min={1990}
              max={2026}
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value)}
            />
          </div>

          <div className="search-field search-field--range">
            <span>Teljesítmény (LE)</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="Tól"
              aria-label="Teljesítmény tól"
              min={0}
              value={powerMin}
              onChange={(e) => setPowerMin(e.target.value)}
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder="Ig"
              aria-label="Teljesítmény ig"
              min={0}
              value={powerMax}
              onChange={(e) => setPowerMax(e.target.value)}
            />
          </div>

          <div className="search-field search-field--range">
            <span>Kilométer</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="Tól"
              aria-label="Kilométer tól"
              min={0}
              value={mileageMin}
              onChange={(e) => setMileageMin(e.target.value)}
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder="Ig"
              aria-label="Kilométer ig"
              min={0}
              value={mileageMax}
              onChange={(e) => setMileageMax(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="search-panel__actions">
        <p className="search-panel__meta">
          <strong>2 847</strong> videós hirdetés · frissítve ma
        </p>
        <button type="submit" className="btn btn--accent btn--lg">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12.2 12.2L15.5 15.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Keresés
        </button>
      </div>
    </form>
  )
}
