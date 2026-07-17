import { useMemo, useState, type FormEvent } from 'react'
import { CAR_MAKES, CAR_MAKES_MODELS } from '../data/carMakesModels'

const fuels = ['Üzemanyag', 'Benzin', 'Dízel', 'Hibrid', 'Elektromos']
const locations = ['Megye / város', 'Budapest', 'Debrecen', 'Győr', 'Szeged', 'Pécs', 'Miskolc']

export function SearchPanel() {
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [yearFrom, setYearFrom] = useState('')
  const [fuel, setFuel] = useState('Üzemanyag')
  const [location, setLocation] = useState('Megye / város')

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
      <div className="search-panel__grid">
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
          <label htmlFor="year">Évjárat tól</label>
          <input
            id="year"
            type="number"
            inputMode="numeric"
            placeholder="2018"
            min={1990}
            max={2026}
            value={yearFrom}
            onChange={(e) => setYearFrom(e.target.value)}
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
            {locations.map((l) => (
              <option key={l} value={l} disabled={l === 'Megye / város'}>
                {l}
              </option>
            ))}
          </select>
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
