export type AppLocale = 'hu' | 'en' | 'es' | 'de'

export type MarketCountry = 'HU' | 'DE' | 'AT' | 'ES' | 'US' | 'MX'

export const APP_LOCALES: AppLocale[] = ['hu', 'en', 'es', 'de']

export const MARKET_COUNTRIES: MarketCountry[] = ['HU', 'DE', 'AT', 'ES', 'US', 'MX']

export const LOCALE_LABELS: Record<AppLocale, string> = {
  hu: 'Magyar',
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
}

export const COUNTRY_LABELS: Record<MarketCountry, string> = {
  HU: 'Hungary',
  DE: 'Germany',
  AT: 'Austria',
  ES: 'Spain',
  US: 'United States',
  MX: 'Mexico',
}

/** Default UI locale for a detected/selected market country */
export const COUNTRY_DEFAULT_LOCALE: Record<MarketCountry, AppLocale> = {
  HU: 'hu',
  DE: 'de',
  AT: 'de',
  ES: 'es',
  US: 'en',
  MX: 'es',
}

export const COUNTRY_CURRENCY: Record<MarketCountry, string> = {
  HU: 'HUF',
  DE: 'EUR',
  AT: 'EUR',
  ES: 'EUR',
  US: 'USD',
  MX: 'MXN',
}

export const LOCALE_BCP47: Record<AppLocale, string> = {
  hu: 'hu-HU',
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
}

const STORAGE_LOCALE = 'carbuy-ui-locale'
const STORAGE_COUNTRY = 'carbuy-browse-country'

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === 'hu' || value === 'en' || value === 'es' || value === 'de'
}

export function isMarketCountry(value: string | null | undefined): value is MarketCountry {
  return (
    value === 'HU' ||
    value === 'DE' ||
    value === 'AT' ||
    value === 'ES' ||
    value === 'US' ||
    value === 'MX'
  )
}

export function localeFromNavigator(): AppLocale {
  const lang = (navigator.language || 'en').toLowerCase()
  if (lang.startsWith('hu')) return 'hu'
  if (lang.startsWith('de')) return 'de'
  if (lang.startsWith('es')) return 'es'
  return 'en'
}

export function countryFromNavigator(): MarketCountry {
  const lang = (navigator.language || '').toLowerCase()
  if (lang.includes('-hu') || lang.startsWith('hu')) return 'HU'
  if (lang.includes('-de') || lang.startsWith('de')) return 'DE'
  if (lang.includes('-at')) return 'AT'
  if (lang.includes('-es') || lang.startsWith('es')) return 'ES'
  if (lang.includes('-mx')) return 'MX'
  if (lang.includes('-us') || lang.startsWith('en')) return 'US'
  return 'HU'
}

export function readStoredLocale(): AppLocale | null {
  try {
    const v = localStorage.getItem(STORAGE_LOCALE)
    return isAppLocale(v) ? v : null
  } catch {
    return null
  }
}

export function readStoredCountry(): MarketCountry | null {
  try {
    const v = localStorage.getItem(STORAGE_COUNTRY)
    return isMarketCountry(v) ? v : null
  } catch {
    return null
  }
}

export function writeStoredLocale(locale: AppLocale) {
  try {
    localStorage.setItem(STORAGE_LOCALE, locale)
  } catch {
    /* ignore */
  }
}

export function writeStoredCountry(country: MarketCountry) {
  try {
    localStorage.setItem(STORAGE_COUNTRY, country)
  } catch {
    /* ignore */
  }
}

export async function detectCountryFromIp(timeoutMs = 2500): Promise<MarketCountry | null> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal })
    if (!res.ok) return null
    const data = (await res.json()) as { country_code?: string }
    const code = data.country_code?.toUpperCase()
    return isMarketCountry(code) ? code : null
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}
