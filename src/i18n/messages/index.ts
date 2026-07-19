import type { AppLocale } from '../locales'
import type { MessageKey, Messages } from '../types'
import { de } from './de'
import { en } from './en'
import { es } from './es'
import { hu } from './hu'

const catalogs: Record<AppLocale, Messages> = { hu, en, es, de }

export function translate(
  locale: AppLocale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  let text = catalogs[locale][key] ?? catalogs.en[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v))
    }
  }
  return text
}
