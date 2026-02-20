'use client'

import { ReactNode, forwardRef } from 'react'

import Link from 'next/link'

import { LinkProvider } from '@cloudflare/kumo'

import AuthProvider from '@components/AuthProvider'
import { RBACProvider } from '@/contexts/RBACContext'
import { PageTitleProvider } from '@/contexts/PageTitleContext'
import { LocaleProvider } from '@/contexts/LocaleContext'
import { LicenseProvider } from '@/contexts/LicenseContext'
import { ToastProvider } from '@/contexts/ToastContext'

// Adapter for Next.js Link to work with Kumo's LinkProvider
const NextLink = forwardRef<HTMLAnchorElement, any>(function NextLinkInner({ href, to, ...props }, ref) {
  return <Link href={href || to || '#'} ref={ref} {...props} />
})

interface KumoProvidersProps {
  children: ReactNode
  locale: string
}

export default function KumoProviders({ children, locale }: KumoProvidersProps) {
  return (
    <AuthProvider session={undefined}>
      <RBACProvider>
        <LicenseProvider>
          <LocaleProvider initialLocale={locale}>
            <PageTitleProvider>
              <ToastProvider>
                <LinkProvider component={NextLink as any}>
                  {children}
                </LinkProvider>
              </ToastProvider>
            </PageTitleProvider>
          </LocaleProvider>
        </LicenseProvider>
      </RBACProvider>
    </AuthProvider>
  )
}
