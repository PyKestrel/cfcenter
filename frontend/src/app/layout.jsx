// Third-party Imports
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'

// Style Imports
import '@/app/globals.css'

// Generated Icon CSS Imports
import '@assets/iconify-icons/generated-icons.css'

export const metadata = {
  title: 'PROXCENTER',
  description:
    'PROXCENTER ADMIN UI'
}

const RootLayout = async props => {
  const { children } = props

  // Get locale and messages for i18n
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html id='__next' lang={locale} dir='ltr' suppressHydrationWarning>
      <body className='flex w-full min-h-full flex-auto flex-col'>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

export default RootLayout
