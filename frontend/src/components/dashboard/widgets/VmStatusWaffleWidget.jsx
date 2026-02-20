'use client'

import React, { useMemo } from 'react'

import { useRouter } from 'next/navigation'

import VmWaffleChart from '@/components/VmWaffleChart'

function VmStatusWaffleWidget({ data, loading }) {
  const router = useRouter()

  // Combine VMs and LXCs for the waffle chart
  const allGuests = useMemo(() => {
    const vms = data?.vmList || []
    const lxcs = data?.lxcList || []
    return [...vms, ...lxcs]
  }, [data?.vmList, data?.lxcList])

  const handleVmClick = (vm) => {
    router.push(`/infrastructure/inventory?selected=${vm.connId}&type=${vm.type}&vmid=${vm.vmid}&node=${vm.node}`)
  }

  if (!data) {
    return (
      <div className='h-full flex items-center justify-center'>
        <span className='text-xs' style={{ color: 'var(--pc-text-muted)' }}>Loading...</span>
      </div>
    )
  }

  if (allGuests.length === 0) {
    return (
      <div className='h-full flex items-center justify-center'>
        <span className='text-xs' style={{ color: 'var(--pc-text-muted)' }}>No VMs found</span>
      </div>
    )
  }

  return (
    <div className='h-full overflow-auto'>
      <VmWaffleChart
        vms={allGuests}
        cellSize={10}
        gap={2}
        maxColumns={25}
        onVmClick={handleVmClick}
        showLegend={false}
        compact
      />
    </div>
  )
}

export default React.memo(VmStatusWaffleWidget)
