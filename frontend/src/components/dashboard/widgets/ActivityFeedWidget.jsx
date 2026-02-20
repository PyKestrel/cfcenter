'use client'

import React from 'react'

import { useTranslations } from 'next-intl'
import { SpinnerGap } from '@phosphor-icons/react'

import { useTaskEvents } from '@/hooks/useTaskEvents'

const STATUS_COLORS = {
  running: '#2196f3',
  OK: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
  success: '#4caf50',
}

function ActivityFeedWidget({ data, loading, config }) {
  const t = useTranslations()
  const { data: eventsData, isLoading: loadingEvents } = useTaskEvents(20, 30000)
  const events = Array.isArray(eventsData?.data) ? eventsData.data : []

  function timeAgo(ts) {
    if (!ts) return ''
    const now = Date.now() / 1000
    const diff = Math.floor(now - ts)

    if (diff < 60) return t('time.justNow')
    if (diff < 3600) return t('time.minutesAgo', { count: Math.floor(diff / 60) })
    if (diff < 86400) return t('time.hoursAgo', { count: Math.floor(diff / 3600) })

    return t('time.daysAgo', { count: Math.floor(diff / 86400) })
  }

  const TASK_LABELS = {
    'qmstart': t('audit.actions.start') + ' VM',
    'qmstop': t('audit.actions.stop') + ' VM',
    'qmshutdown': 'Shutdown VM',
    'qmreboot': t('audit.actions.restart') + ' VM',
    'qmmigrate': t('audit.actions.migrate') + ' VM',
    'qmclone': t('audit.actions.clone') + ' VM',
    'vzdump': t('audit.actions.backup'),
    'vzcreate': t('audit.actions.create') + ' CT',
    'vzstart': t('audit.actions.start') + ' CT',
    'vzstop': t('audit.actions.stop') + ' CT',
    'pull': 'Sync PBS',
    'verify': t('backups.verified'),
    'garbage_collection': 'GC PBS',
  }

  if (loadingEvents) {
    return (
      <div className='h-full flex items-center justify-center'>
        <SpinnerGap size={24} className='animate-spin' style={{ color: 'var(--pc-primary)' }} />
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className='h-full flex items-center justify-center p-4'>
        <div className='w-full text-center text-sm px-3 py-2 rounded-lg' style={{ backgroundColor: 'var(--pc-bg-subtle)', color: 'var(--pc-text-muted)' }}>
          {t('common.noData')}
        </div>
      </div>
    )
  }

  return (
    <div className='h-full overflow-auto'>
      {events.map((event, idx) => {
        const statusKey = event.status === 'running' ? 'running'
          : event.status === 'OK' ? 'OK'
          : event.status?.includes('WARNINGS') ? 'warning'
          : event.level === 'error' ? 'error' : 'success'

        const statusLabel = event.status === 'running' ? t('jobs.running')
          : event.status === 'OK' ? 'OK'
          : event.status?.includes('WARNINGS') ? t('common.warning')
          : event.level === 'error' ? t('common.error') : 'OK'

        const color = STATUS_COLORS[statusKey] || STATUS_COLORS.success

        return (
          <div key={idx} className='px-1.5 py-1.5 border-b' style={{ borderColor: 'var(--pc-border-subtle)' }}>
            <div className='flex items-center gap-1.5'>
              <span
                className='inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded min-w-[50px] text-center text-white'
                style={{ backgroundColor: color }}
              >
                {statusLabel}
              </span>
              <span className='text-[11px] font-semibold'>
                {TASK_LABELS[event.type] || event.typeLabel || event.type}
              </span>
            </div>
            <div className='flex items-center gap-2 mt-0.5'>
              {event.entity && (
                <span className='text-[10px] opacity-70'>{event.entity}</span>
              )}
              <span className='text-[9px] opacity-50'>
                {timeAgo(event.starttime || event.ts)} • {event.node}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default React.memo(ActivityFeedWidget)
