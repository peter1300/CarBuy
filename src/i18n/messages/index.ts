import type { AppLocale } from '../locales'
import { readStoredLocale, localeFromNavigator, isAppLocale } from '../locales'
import type { MessageKey, Messages } from '../types'
import { de } from './de'
import { en } from './en'
import { es } from './es'
import { hu } from './hu'

const catalogs: Record<AppLocale, Messages> = { hu, en, es, de }

let activeLocale: AppLocale = readStoredLocale() ?? localeFromNavigator()

export function setActiveLocale(locale: AppLocale) {
  activeLocale = locale
}

export function getActiveLocale(): AppLocale {
  return activeLocale
}

export function translate(
  locale: AppLocale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  let text = catalogs[locale][key] ?? catalogs.en[key] ?? catalogs.hu[key] ?? key
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
