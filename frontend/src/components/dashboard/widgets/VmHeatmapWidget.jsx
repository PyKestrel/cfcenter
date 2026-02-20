'use client'

import React, { useMemo, useState, useCallback } from 'react'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

// Color gradient: green (low) → yellow (mid) → red (high)
function getHeatColor(pct) {
  const p = Math.max(0, Math.min(100, pct))

  if (p < 30) {
    // Green
    const t = p / 30
    const r = Math.round(34 + t * (100))
    const g = Math.round(197 + t * (7))
    const b = Math.round(94 - t * (72))
    return `rgb(${r},${g},${b})`
  }
  if (p < 60) {
    // Yellow-orange
    const t = (p - 30) / 30
    const r = Math.round(134 + t * (100))
    const g = Math.round(204 - t * (24))
    const b = Math.round(22 - t * (14))
    return `rgb(${r},${g},${b})`
  }
  if (p < 80) {
    // Orange-red
    const t = (p - 60) / 20
    const r = Math.round(234 + t * (5))
    const g = Math.round(180 - t * (112))
    const b = Math.round(8 + t * (60))
    return `rgb(${r},${g},${b})`
  }
  // Deep red
  const t = (p - 80) / 20
  const r = Math.round(239 - t * (30))
  const g = Math.round(68 - t * (40))
  const b = Math.round(68 - t * (30))
  return `rgb(${r},${g},${b})`
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`
}

function TileTooltipContent({ vm, metric }) {
  return (
    <div style={{ minWidth: 180 }}>
      <div className='flex items-center gap-1 mb-1'>
        <i className={vm.type === 'lxc' ? 'ri-instance-line' : 'ri-computer-line'} style={{ fontSize: 13, opacity: 0.7 }} />
        <span className='text-xs font-bold'>{vm.name || `VM ${vm.vmid}`}</span>
      </div>
      <span className='text-[10px] block mb-1.5' style={{ color: 'var(--pc-text-muted)' }}>
        #{vm.vmid} · {vm.type === 'lxc' ? 'LXC' : 'VM'} · {vm.node}
      </span>
      <div className='flex gap-4'>
        <div>
          <span className='text-[10px] block' style={{ color: 'var(--pc-text-muted)' }}>CPU</span>
          <span className='text-xs block' style={{ fontWeight: metric === 'cpu' ? 700 : 400, fontFamily: '"JetBrains Mono", monospace' }}>{vm.cpuPct}%</span>
        </div>
        <div>
          <span className='text-[10px] block' style={{ color: 'var(--pc-text-muted)' }}>RAM</span>
          <span className='text-xs block' style={{ fontWeight: metric === 'ram' ? 700 : 400, fontFamily: '"JetBrains Mono", monospace' }}>{vm.ramPct}%</span>
        </div>
        <div>
          <span className='text-[10px] block' style={{ color: 'var(--pc-text-muted)' }}>Alloc</span>
          <span className='text-xs block' style={{ fontFamily: '"JetBrains Mono", monospace' }}>{formatBytes(vm.maxmem)}</span>
        </div>
      </div>
    </div>
  )
}

// Simple squarified-ish treemap layout within a rectangular area
function computeTreemapLayout(items, width, height) {
  if (items.length === 0 || width <= 0 || height <= 0) return []

  const totalValue = items.reduce((s, it) => s + it.value, 0)
  if (totalValue <= 0) return items.map((it, i) => ({ ...it, x: 0, y: 0, w: 0, h: 0 }))

  const rects = []
  let remaining = [...items].sort((a, b) => b.value - a.value)
  let x = 0, y = 0, w = width, h = height
  let remainingValue = totalValue

  while (remaining.length > 0) {
    const isHorizontal = w >= h

    // Find best split for the current strip
    let bestRatio = Infinity
    let bestCount = 1

    for (let count = 1; count <= remaining.length; count++) {
      const stripItems = remaining.slice(0, count)
      const stripValue = stripItems.reduce((s, it) => s + it.value, 0)

      const stripSize = isHorizontal
        ? (stripValue / remainingValue) * w
        : (stripValue / remainingValue) * h

      let worstRatio = 0
      let offset = 0

      for (const item of stripItems) {
        const frac = item.value / stripValue
        const itemLen = isHorizontal ? frac * h : frac * w

        if (stripSize > 0 && itemLen > 0) {
          const ratio = Math.max(stripSize / itemLen, itemLen / stripSize)
          worstRatio = Math.max(worstRatio, ratio)
        }

        offset += itemLen
      }

      if (worstRatio <= bestRatio) {
        bestRatio = worstRatio
        bestCount = count
      } else {
        break // Ratio getting worse, stop
      }
    }

    // Layout the strip
    const stripItems = remaining.slice(0, bestCount)
    const stripValue = stripItems.reduce((s, it) => s + it.value, 0)

    const stripSize = isHorizontal
      ? Math.max(1, (stripValue / remainingValue) * w)
      : Math.max(1, (stripValue / remainingValue) * h)

    let offset = 0

    for (const item of stripItems) {
      const frac = stripValue > 0 ? item.value / stripValue : 1 / stripItems.length
      const itemLen = isHorizontal ? frac * h : frac * w

      rects.push({
        ...item,
        x: isHorizontal ? x : x + offset,
        y: isHorizontal ? y + offset : y,
        w: isHorizontal ? stripSize : itemLen,
        h: isHorizontal ? itemLen : stripSize,
      })

      offset += itemLen
    }

    // Shrink remaining area
    if (isHorizontal) {
      x += stripSize
      w -= stripSize
    } else {
      y += stripSize
      h -= stripSize
    }

    remainingValue -= stripValue
    remaining = remaining.slice(bestCount)
  }

  return rects
}

function VmHeatmapWidget({ data, loading: dashboardLoading }) {
  const t = useTranslations()
  const router = useRouter()
  const [metric, setMetric] = useState('ram')

  // Combine VMs + LXC, compute metrics
  const guests = useMemo(() => {
    const vms = data?.vmList || []
    const lxcs = data?.lxcList || []
    const all = [...vms, ...lxcs].filter(g => g.status === 'running' && !g.template)

    return all.map((g) => {
      const cpuPct = Math.round((Number(g.cpu) || 0) * 100)
      const mem = Number(g.mem) || 0
      const maxmem = Number(g.maxmem) || 0
      const ramPct = maxmem > 0 ? Math.round((mem / maxmem) * 100) : 0

      return { ...g, cpuPct, ramPct }
    })
  }, [data?.vmList, data?.lxcList])

  // Group by node
  const nodeGroups = useMemo(() => {
    const groups = {}

    guests.forEach((g) => {
      const key = g.node || 'unknown'
      if (!groups[key]) groups[key] = { node: key, vms: [], totalMem: 0 }
      groups[key].vms.push(g)
      groups[key].totalMem += Number(g.maxmem) || 0
    })

    return Object.values(groups).sort((a, b) => b.totalMem - a.totalMem)
  }, [guests])

  // Stats
  const stats = useMemo(() => {
    if (guests.length === 0) return null

    const vals = guests.map(g => metric === 'cpu' ? g.cpuPct : g.ramPct)
    const avg = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
    const max = Math.max(...vals)
    const hot = vals.filter(v => v >= 80).length

    return { avg, max, hot, total: guests.length }
  }, [guests, metric])

  const handleClick = useCallback((vm) => {
    router.push(`/infrastructure/inventory?selected=${vm.connId}&type=${vm.type}&vmid=${vm.vmid}&node=${vm.node}`)
  }, [router])

  if (!data || dashboardLoading) {
    return (
      <div className='h-full flex items-center justify-center'>
        <span className='text-xs' style={{ color: 'var(--pc-text-muted)' }}>Loading...</span>
      </div>
    )
  }

  if (guests.length === 0) {
    return (
      <div className='h-full flex items-center justify-center'>
        <span className='text-xs' style={{ color: 'var(--pc-text-muted)' }}>{t('common.noData')}</span>
      </div>
    )
  }

  return (
    <div className='h-full flex flex-col'>
      {/* Header */}
      <div className='flex justify-between items-center mb-2 gap-2'>
        {stats && (
          <div className='flex gap-3 items-center'>
            <span className='text-[10px]' style={{ color: 'var(--pc-text-muted)' }}>{stats.total} guests</span>
            <span className='text-[10px]' style={{ color: 'var(--pc-text-muted)' }}>
              Avg <span className='font-bold' style={{ color: 'var(--pc-text)', fontFamily: '"JetBrains Mono", monospace' }}>{stats.avg}%</span>
            </span>
            {stats.hot > 0 && (
              <span className='text-[10px] font-semibold' style={{ color: 'var(--pc-error)' }}>{stats.hot} hot</span>
            )}
          </div>
        )}

        <div className='flex rounded overflow-hidden border' style={{ borderColor: 'var(--pc-border)' }}>
          {['cpu', 'ram'].map((val) => (
            <button key={val} onClick={() => setMetric(val)}
              className='px-2.5 py-0.5 text-[11px] font-medium transition-colors'
              style={{
                backgroundColor: metric === val ? 'var(--pc-primary)' : 'transparent',
                color: metric === val ? '#fff' : 'var(--pc-text-secondary)',
              }}>
              {val.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Treemap area */}
      <div className='flex-1 overflow-auto min-h-0'>
        {nodeGroups.map((group) => (
          <div key={group.node} className='mb-2'>
            <div className='flex items-center gap-1 mb-1'>
              <i className='ri-server-line' style={{ fontSize: 11, color: 'var(--pc-text-muted)' }} />
              <span className='text-[10px] font-semibold' style={{ color: 'var(--pc-text-muted)' }}>{group.node}</span>
              <span className='text-[9px]' style={{ color: 'var(--pc-text-muted)', opacity: 0.6 }}>({group.vms.length})</span>
            </div>
            <TreemapGroup vms={group.vms} metric={metric} onClick={handleClick} />
          </div>
        ))}
      </div>

      {/* Color scale legend */}
      <div className='flex items-center gap-2 mt-1 px-1'>
        <span className='text-[9px]' style={{ color: 'var(--pc-text-muted)' }}>0%</span>
        <div className='flex-1 h-1.5 rounded-full' style={{ background: `linear-gradient(to right, ${getHeatColor(0)}, ${getHeatColor(30)}, ${getHeatColor(60)}, ${getHeatColor(80)}, ${getHeatColor(100)})` }} />
        <span className='text-[9px]' style={{ color: 'var(--pc-text-muted)' }}>100%</span>
        <span className='text-[9px] ml-1' style={{ color: 'var(--pc-text-muted)' }}>{metric.toUpperCase()}</span>
      </div>
    </div>
  )
}

// Sub-component: renders the treemap tiles for a single node group
function TreemapGroup({ vms, metric, onClick }) {
  const containerRef = React.useRef(null)
  const [dims, setDims] = React.useState({ w: 0, h: 0 })
  const [hoveredId, setHoveredId] = React.useState(null)

  React.useEffect(() => {
    if (!containerRef.current) return

    const obs = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect
      const h = Math.max(60, Math.min(160, 20 + vms.length * 8))
      setDims({ w: width, h })
    })

    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [vms.length])

  const tiles = useMemo(() => {
    if (dims.w <= 0 || dims.h <= 0) return []

    const items = vms.map((vm) => ({
      ...vm,
      value: Math.max(Number(vm.maxmem) || 1, 1),
    }))

    return computeTreemapLayout(items, dims.w, dims.h)
  }, [vms, dims.w, dims.h])

  return (
    <div
      ref={containerRef}
      className='relative w-full rounded overflow-hidden'
      style={{
        height: Math.max(60, Math.min(160, 20 + vms.length * 8)),
        backgroundColor: 'var(--pc-bg-subtle)',
      }}
    >
      {tiles.map((tile) => {
        const val = metric === 'cpu' ? tile.cpuPct : tile.ramPct
        const bgColor = getHeatColor(val)
        const showLabel = tile.w > 40 && tile.h > 18
        const isHovered = hoveredId === tile.id

        return (
          <div
            key={tile.id}
            onClick={() => onClick(tile)}
            onMouseEnter={() => setHoveredId(tile.id)}
            onMouseLeave={() => setHoveredId(null)}
            title={`${tile.name || tile.vmid} — CPU: ${tile.cpuPct}% RAM: ${tile.ramPct}%`}
            className='absolute flex items-center justify-center overflow-hidden cursor-pointer'
            style={{
              left: tile.x,
              top: tile.y,
              width: Math.max(tile.w - 1, 1),
              height: Math.max(tile.h - 1, 1),
              backgroundColor: bgColor,
              border: '0.5px solid rgba(0,0,0,0.15)',
              transition: 'filter 0.1s',
              filter: isHovered ? 'brightness(1.2)' : 'none',
              zIndex: isHovered ? 10 : 0,
              outline: isHovered ? '2px solid white' : 'none',
            }}
          >
            {showLabel && (
              <span style={{
                fontSize: Math.min(10, tile.h * 0.5),
                fontWeight: 600,
                color: val > 60 ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.75)',
                lineHeight: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                padding: '0 2px',
                textShadow: val > 60 ? '0 0 2px rgba(0,0,0,0.3)' : '0 0 2px rgba(255,255,255,0.3)',
              }}>
                {tile.name || tile.vmid}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default React.memo(VmHeatmapWidget)
