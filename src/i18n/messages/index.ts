import type { AppLocale } from '../locales'
import { readStoredLocale, localeFromNavigator, isAppLocale } from '../locales'
import type { MessageKey, Messages } from '../types'

const catalogLoaders: Record<AppLocale, () => Promise<Messages>> = {
  hu: () => import('./hu').then((m) => m.hu),
  en: () => import('./en').then((m) => m.en),
  es: () => import('./es').then((m) => m.es),
  de: () => import('./de').then((m) => m.de),
}

const catalogs: Partial<Record<AppLocale, Messages>> = {}
const loading = new Map<AppLocale, Promise<Messages>>()

let activeLocale: AppLocale = readStoredLocale() ?? localeFromNavigator()

export function setActiveLocale(locale: AppLocale) {
  activeLocale = locale
}

export function getActiveLocale(): AppLocale {
  return activeLocale
}

export async function preloadCatalog(locale: AppLocale): Promise<void> {
  await loadCatalog(locale)
  // English fallback for missing keys
  if (locale !== 'en') {
    await loadCatalog('en').catch(() => undefined)
  }
}

async function loadCatalog(locale: AppLocale): Promise<Messages> {
  const cached = catalogs[locale]
  if (cached) return cached

  let pending = loading.get(locale)
  if (!pending) {
    pending = catalogLoaders[locale]().then((messages) => {
      catalogs[locale] = messages
      loading.delete(locale)
      return messages
    })
    loading.set(locale, pending)
  }
  return pending
}

export function translate(
  locale: AppLocale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  let text =
    catalogs[locale]?.[key] ??
    catalogs.en?.[key] ??
    catalogs.hu?.[key] ??
    key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.split(`{${k}}`).join(String(v))
    }
  }
  return text
}

/** For non-React modules (contexts, validators). */
export function tGlobal(key: MessageKey, vars?: Record<string, string | number>): string {
  const locale = isAppLocale(activeLocale) ? activeLocale : 'en'
  return translate(locale, key, vars)
}

/** Ensures locale catalog is loaded (fire-and-forget for background preload). */
export function warmCatalog(locale: AppLocale): void {
  void preloadCatalog(locale)
}
