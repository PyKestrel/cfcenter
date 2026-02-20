'use client'

import React, { useEffect, useState } from 'react'

import { useTranslations } from 'next-intl'
import { SpinnerGap } from '@phosphor-icons/react'

import { formatBytes } from '@/utils/format'

function StoragePoolsWidget({ data, loading, config }) {
  const t = useTranslations()
  const [storages, setStorages] = useState([])
  const [loadingStorages, setLoadingStorages] = useState(true)

  useEffect(() => {
    const fetchStorages = async () => {
      try {
        // Récupérer les storages de toutes les connexions
        const connRes = await fetch('/api/v1/connections?type=pve')

        if (!connRes.ok) return
        const connJson = await connRes.json()
        const connections = connJson?.data || []

        const allStorages = []
        
        await Promise.all(connections.map(async (conn) => {
          try {
            const res = await fetch(`/api/v1/connections/${encodeURIComponent(conn.id)}/storage`)

            if (res.ok) {
              const json = await res.json()
              const storageList = Array.isArray(json?.data) ? json.data : []

              storageList.forEach(s => {
                if (s.total && s.total > 0) {
                  allStorages.push({
                    ...s,
                    connectionName: conn.name,
                    connectionId: conn.id,
                  })
                }
              })
            }
          } catch (e) {
            console.error(`Failed to fetch storage for ${conn.id}:`, e)
          }
        }))

        // Trier par utilisation décroissante
        allStorages.sort((a, b) => {
          const aUsage = a.total ? (a.used / a.total) : 0
          const bUsage = b.total ? (b.used / b.total) : 0

          
return bUsage - aUsage
        })

        setStorages(allStorages)
      } catch (e) {
        console.error('Failed to fetch storages:', e)
      } finally {
        setLoadingStorages(false)
      }
    }

    fetchStorages()
  }, [])

  if (loadingStorages) {
    return (
      <div className='h-full flex items-center justify-center'>
        <SpinnerGap size={24} className='animate-spin' style={{ color: 'var(--pc-primary)' }} />
      </div>
    )
  }

  if (storages.length === 0) {
    return (
      <div className='h-full flex items-center justify-center p-4'>
        <div className='w-full text-center text-sm px-3 py-2 rounded-lg' style={{ backgroundColor: '#2196f318', color: '#2196f3' }}>{t('common.noData')}</div>
      </div>
    )
  }

  return (
    <div className='h-full overflow-auto p-1'>
      {storages.slice(0, 8).map((storage, idx) => {
        const usagePct = storage.total ? Math.round((storage.used / storage.total) * 100) : 0

        return (
          <div key={idx} className='py-1.5 border-b last:border-b-0' style={{ borderColor: 'var(--pc-border-subtle)' }}>
            <div className='flex items-center justify-between mb-1'>
              <div className='flex items-center gap-2 min-w-0'>
                <i className='ri-hard-drive-2-line' style={{ fontSize: 14, opacity: 0.6 }} />
                <span className='text-[11px] font-bold'>{storage.storage}</span>
                <span className='text-[9px] opacity-70 px-1 py-0.5 rounded' style={{ backgroundColor: 'var(--pc-bg-subtle)' }}>{storage.type || 'dir'}</span>
              </div>
            </div>
            <div className='relative h-3.5 rounded-sm overflow-hidden' style={{ backgroundColor: 'var(--pc-bg-subtle)' }}>
              <div className='absolute inset-y-0 left-0 rounded-sm' style={{ width: `${usagePct}%`, background: 'linear-gradient(90deg, #22c55e 0%, #eab308 50%, #ef4444 100%)', backgroundSize: usagePct > 0 ? `${(100 / usagePct) * 100}% 100%` : '100% 100%' }} />
              <span className='absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white' style={{ textShadow: '0 0 2px rgba(0,0,0,0.5)' }}>{usagePct}%</span>
            </div>
            <div className='flex justify-between mt-0.5'>
              <span className='text-[9px] opacity-50'>{storage.connectionName}</span>
              <span className='text-[9px] opacity-50'>{formatBytes(storage.used)} / {formatBytes(storage.total)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default React.memo(StoragePoolsWidget)
