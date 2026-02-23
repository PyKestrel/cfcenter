// src/i18n/config.ts
export const locales = ['fr', 'en', 'es', 'de', 'pt', 'it', 'ja', 'zh'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'fr'

// Labels for each locale
export const localeNames: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  pt: 'Português',
  it: 'Italiano',
  ja: '日本語',
  zh: '中文'
}

// Flag emojis for each locale
export const localeFlags: Record<Locale, string> = {
  fr: '🇫🇷',
  en: '🇬🇧',
  es: '🇪🇸',
  de: '🇩🇪',
  pt: '🇧🇷',
  it: '🇮🇹',
  ja: '🇯🇵',
  zh: '🇨🇳'
}
