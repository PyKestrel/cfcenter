'use client'

import React, { useEffect } from 'react'

import { useSearchParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

export default function FullscreenConsolePage({ params }) {
  const t = useTranslations()
  const router = useRouter()
  const resolvedParams = React.use(params)
  const { type, node, vmid } = resolvedParams || {}
  const searchParams = useSearchParams()
  const connId = searchParams.get('connId') || '1'
  const engine = searchParams.get('engine') // 'guac' or 'novnc' or null (auto)

  useEffect(() => {
    if (!type || !node || !vmid || !connId) return

    const baseParams = `connId=${encodeURIComponent(connId)}&type=${encodeURIComponent(type)}&node=${encodeURIComponent(node)}&vmid=${encodeURIComponent(vmid)}`

    // If engine is explicitly set, use it directly
    if (engine === 'guac') {
      window.location.href = `/guacamole/console.html?${baseParams}`

      return
    }

    if (engine === 'novnc') {
      window.location.href = `/novnc/console.html?${baseParams}`

      return
    }

    // Auto-detect: check if guacd is available, prefer Guacamole if so
    async function detectAndRedirect() {
      try {
        const res = await fetch('/api/internal/guacd/health')

        if (res.ok) {
          const data = await res.json()

          if (data.available) {
            window.location.href = `/guacamole/console.html?${baseParams}`

            return
          }
        }
      } catch {
        // guacd health check failed, fall through to noVNC
      }

      // Default: noVNC
      window.location.href = `/novnc/console.html?${baseParams}`
    }

    detectAndRedirect()
  }, [type, node, vmid, connId, engine])

  // Afficher un écran de chargement pendant la redirection
  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      margin: 0, 
      padding: 0, 
      overflow: 'hidden',
      background: '#000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#666'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>&#9203;</div>
        <div>{t('console.loadingConsole')}</div>
      </div>
    </div>
  )
}
