'use client'

import { useEffect } from 'react'

import { useTranslations } from 'next-intl'
import { Banner, Button } from '@cloudflare/kumo'

import WidgetGrid from '@/components/dashboard/WidgetGrid'
import { usePageTitle } from '@/contexts/PageTitleContext'
import { useDashboard } from '@/hooks/useDashboard'

function useTimeAgo() {
  const t = useTranslations('time')

  return (date) => {
    const now = new Date()
    const past = new Date(date)
    const diff = Math.floor((now - past) / 1000)

    if (diff < 60) return t('secondsAgo')
    if (diff < 3600) return t('minutesAgo', { count: Math.floor(diff / 60) })
    if (diff < 86400) return t('hoursAgo', { count: Math.floor(diff / 3600) })

    return t('daysAgo', { count: Math.floor(diff / 86400) })
  }
}

export default function HomePage() {
  const t = useTranslations()
  const timeAgo = useTimeAgo()
  const { setPageInfo } = usePageTitle()

  const { data: dashboardResponse, error, isLoading, isValidating, mutate } = useDashboard(30000)
  const data = dashboardResponse?.data ?? null
  const loading = isLoading
  const lastRefresh = dashboardResponse ? new Date() : null

  // Mettre à jour le titre dans le header
  useEffect(() => {
    setPageInfo(t('dashboard.title'), lastRefresh ? t('time.synced', { time: timeAgo(lastRefresh) }) : t('common.loading'), 'ri-dashboard-line')
  }, [lastRefresh, setPageInfo, t, timeAgo])

  // Nettoyer le titre quand on quitte la page
  useEffect(() => {
    return () => setPageInfo('', '', '')
  }, [setPageInfo])

  if (error && !data) {
    return (
      <div className='p-6'>
        <Banner type='error'>{t('dashboard.loadingError')}: {error.message}</Banner>
        <Button variant='outline' onClick={() => mutate()} className='mt-4'>{t('common.retry')}</Button>
      </div>
    )
  }

  return (
    <div className='flex flex-col h-full min-h-0'>
      {/* Widget Grid - avec boutons refresh et personnaliser */}
      <div className='flex-1 min-h-0 overflow-auto'>
        <WidgetGrid data={data} loading={loading && !data} onRefresh={() => mutate()} refreshLoading={isValidating} />
      </div>
    </div>
  )
}
