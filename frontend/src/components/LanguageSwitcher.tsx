'use client'

import { useState, useRef, useEffect } from 'react'
import { useLocale } from 'next-intl'
import { Globe } from '@phosphor-icons/react'
import { Tooltip } from '@cloudflare/kumo'

import { locales, localeNames, localeFlags, type Locale } from '@/i18n/config'
import { setLocale } from '@/i18n/client'

export default function LanguageSwitcher() {
  const currentLocale = useLocale() as Locale
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handler)

    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <Tooltip content={localeNames[currentLocale]}>
        <button
          className="flex items-center justify-center w-9 h-9 rounded-full transition-colors hover:bg-[var(--pc-border-subtle)] cursor-pointer"
          style={{ color: 'var(--pc-text-secondary)' }}
          onClick={() => setOpen(prev => !prev)}
          aria-label="Change language"
        >
          <Globe size={18} />
        </button>
      </Tooltip>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 z-50 min-w-[140px] rounded-lg border shadow-lg overflow-hidden"
          style={{
            background: 'var(--pc-bg-elevated)',
            borderColor: 'var(--pc-border)',
          }}
        >
          {locales.map(locale => (
            <button
              key={locale}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--pc-border-subtle)]"
              style={{
                color: locale === currentLocale ? 'var(--pc-primary)' : 'var(--pc-text-secondary)',
                fontWeight: locale === currentLocale ? 600 : 400,
              }}
              onClick={() => {
                if (locale !== currentLocale) {
                  setLocale(locale)
                }

                setOpen(false)
              }}
            >
              <span className="text-base leading-none">{localeFlags[locale]}</span>
              <span>{localeNames[locale]}</span>
              {locale === currentLocale && (
                <span className="ml-auto text-[10px] opacity-60">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
