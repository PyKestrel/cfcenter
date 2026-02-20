// i18n
import { getLocale } from 'next-intl/server'

// Kumo Layout Components
import KumoProviders from '@components/kumo/KumoProviders'
import Sidebar from '@components/kumo/Sidebar'
import Header from '@components/kumo/Header'
import OnboardingGuard from '@components/OnboardingGuard'
import TasksFooter from '@components/TasksFooter'

const Layout = async props => {
  const { children } = props
  const locale = await getLocale()

  return (
    <KumoProviders locale={locale}>
      <div className='pc-layout'>
        <Sidebar />
        <div className='pc-main'>
          <Header />
          <main className='pc-content'>
            <OnboardingGuard>{children}</OnboardingGuard>
          </main>
          <TasksFooter />
        </div>
      </div>
    </KumoProviders>
  )
}

export default Layout