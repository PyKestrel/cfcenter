// Client-side locale utilities
import { locales, type Locale } from './config'

/**
 * Set the active locale by updating the NEXT_LOCALE cookie and reloading.
 */
export function setLocale(locale: Locale) {
  if (!locales.includes(locale)) return

  // Set cookie (1 year expiry)
  document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`

  // Reload to pick up new locale server-side
  window.location.reload()
}

/**
 * Read the current locale from the NEXT_LOCALE cookie.
 */
export function getClientLocale(): Locale | undefined {
  const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]*)/)

  return match?.[1] as Locale | undefined
}
