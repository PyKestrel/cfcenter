'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useTranslations } from 'next-intl'
import { ResponsiveGridLayout } from 'react-grid-layout'
import {
  Button, DialogRoot, DialogTitle, DialogDescription, DialogClose,
  Tabs, Tooltip, Toast, Surface, SkeletonLine, Badge
} from '@cloudflare/kumo'
import { X, Plus, GearSix, Check, ArrowsClockwise, SpinnerGap } from '@phosphor-icons/react'

import { WIDGET_REGISTRY, WIDGET_CATEGORIES, getWidgetsByCategory } from './widgetRegistry'
import { DEFAULT_LAYOUT, PRESET_LAYOUTS } from './types'
import { CardsSkeleton } from '@/components/skeletons'

const GRID_COLS = { lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 }
const ROW_HEIGHT = 60
const MARGIN = [16, 16]

// Génère un ID unique
function generateId() {
  return `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Composant Widget Container
function WidgetContainer({
  config,
  data,
  loading,
  editMode,
  onRemove,
  t,
}) {
  const widgetDef = WIDGET_REGISTRY[config.type]
  const WidgetComponent = widgetDef?.component

  // Get translated widget name
  const widgetNameKey = config.type.replace(/-([a-z])/g, (m, c) => c.toUpperCase())
  const widgetName = t(`dashboard.widgetNames.${widgetNameKey}`, { defaultValue: widgetDef?.name || config.type })

  if (!WidgetComponent) {
    return (
      <Surface className='h-full flex items-center justify-center border rounded-lg'>
        <span className='text-xs' style={{ color: 'var(--pc-error)' }}>{t('dashboard.unknownWidget')} {config.type}</span>
      </Surface>
    )
  }

  return (
    <Surface
      className={`h-full flex flex-col relative overflow-hidden border rounded-lg transition-shadow ${editMode ? 'hover:shadow-md ring-1 ring-transparent hover:ring-[var(--pc-primary)]' : ''}`}
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      {/* Header - zone de drag */}
      <div
        className="widget-drag-handle flex items-center justify-between px-4 py-2 border-b"
        style={{
          borderColor: 'var(--pc-border-subtle)',
          cursor: editMode ? 'move' : 'default',
        }}
      >
        <div className='flex items-center gap-2 min-w-0'>
          <i className={widgetDef.icon} style={{ fontSize: 14, color: 'var(--pc-text-muted)' }} />
          <span className='text-xs font-semibold tracking-wide uppercase truncate' style={{ color: 'var(--pc-text-secondary)', letterSpacing: '0.04em' }}>{widgetName}</span>
        </div>
        {editMode && (
          <Tooltip content={t('common.delete')}>
            <button onClick={onRemove} className='p-0.5 rounded hover:bg-[var(--pc-border-subtle)] transition-colors'>
              <X size={14} />
            </button>
          </Tooltip>
        )}
      </div>

      {/* Content */}
      <div className='flex-1 p-3 overflow-hidden'>
        {loading ? (
          <div className='h-full p-1'>
            <SkeletonLine className='w-full h-full rounded' />
          </div>
        ) : (
          <WidgetComponent config={config} data={data} loading={loading} />
        )}
      </div>
    </Surface>
  )
}

// Dialog pour ajouter un widget
function AddWidgetDialog({ open, onClose, onAdd, t }) {
  const [tab, setTab] = useState(0)
  const categories = WIDGET_CATEGORIES

  // Get translated category name
  const getCategoryName = (cat) => t(`dashboard.categories.${cat.id}`, { defaultValue: cat.name })

  // Get translated widget name and description
  const getWidgetName = (widget) => {
    const key = widget.type.replace(/-([a-z])/g, (m, c) => c.toUpperCase())

    return t(`dashboard.widgetNames.${key}`, { defaultValue: widget.name })
  }

  const getWidgetDesc = (widget) => {
    const key = widget.type.replace(/-([a-z])/g, (m, c) => c.toUpperCase())

    return t(`dashboard.widgetDescs.${key}`, { defaultValue: widget.description })
  }

  if (!open) return null

  return (
    <DialogRoot open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'>
        <Surface className='w-full max-w-lg rounded-xl border shadow-xl' style={{ backgroundColor: 'var(--pc-bg-card)' }}>
          <div className='flex items-center gap-2 px-5 py-4 border-b' style={{ borderColor: 'var(--pc-border-subtle)' }}>
            <Plus size={20} />
            <span className='text-base font-semibold'>{t('dashboard.addWidget')}</span>
            <button onClick={onClose} className='ml-auto p-1 rounded hover:bg-[var(--pc-border-subtle)]'>
              <X size={16} />
            </button>
          </div>

          {/* Category tabs */}
          <div className='flex gap-1 px-4 pt-3 pb-0 overflow-x-auto border-b' style={{ borderColor: 'var(--pc-border-subtle)' }}>
            {categories.map((cat, idx) => (
              <button
                key={cat.id}
                onClick={() => setTab(idx)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t transition-colors whitespace-nowrap ${
                  tab === idx
                    ? 'border-b-2 text-[var(--pc-primary)]'
                    : 'text-[var(--pc-text-muted)] hover:text-[var(--pc-text-primary)]'
                }`}
                style={tab === idx ? { borderColor: 'var(--pc-primary)' } : {}}
              >
                <i className={cat.icon} style={{ fontSize: 14 }} />
                {getCategoryName(cat)}
              </button>
            ))}
          </div>

          {/* Widget list */}
          <div className='p-4 max-h-[400px] overflow-y-auto'>
            <div className='grid grid-cols-2 gap-3'>
              {getWidgetsByCategory(categories[tab]?.id).map((widget) => (
                <button
                  key={widget.type}
                  className='text-left p-3 border rounded-lg cursor-pointer transition-all hover:border-[var(--pc-primary)] hover:bg-[var(--pc-bg-subtle)]'
                  style={{ borderColor: 'var(--pc-border-subtle)' }}
                  onClick={() => onAdd(widget.type)}
                >
                  <div className='flex items-center gap-2 mb-1'>
                    <i className={widget.icon} style={{ fontSize: 18, opacity: 0.7 }} />
                    <span className='text-sm font-bold'>{getWidgetName(widget)}</span>
                  </div>
                  <span className='text-xs opacity-60'>{getWidgetDesc(widget)}</span>
                  <div className='mt-2'>
                    <Badge>{`${widget.defaultSize.w}x${widget.defaultSize.h}`}</Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className='flex justify-end px-5 py-3 border-t' style={{ borderColor: 'var(--pc-border-subtle)' }}>
            <Button variant='outline' onClick={onClose}>{t('common.close')}</Button>
          </div>
        </Surface>
      </div>
    </DialogRoot>
  )
}

// Composant principal
export default function WidgetGrid({ data, loading, onRefresh, refreshLoading }) {
  const t = useTranslations()
  const [layout, setLayout] = useState(DEFAULT_LAYOUT)
  const [editMode, setEditMode] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [layoutMenuAnchor, setLayoutMenuAnchor] = useState(null)
  const [saving, setSaving] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  const [layoutLoaded, setLayoutLoaded] = useState(false)

  // Mesure de la largeur du conteneur (requis par react-grid-layout v2.x)
  const [containerWidth, setContainerWidth] = useState(1200) // Largeur par défaut
  const resizeObserverRef = useRef(null)

  const containerRef = useCallback((node) => {
    // Cleanup previous observer
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect()
    }

    if (!node) return

    const measureWidth = () => {
      const width = node.getBoundingClientRect().width

      if (width > 0) {
        setContainerWidth(width)
      }
    }

    // Mesure immédiate
    measureWidth()

    // Observer les changements de taille
    resizeObserverRef.current = new ResizeObserver(() => {
      measureWidth()
    })

    resizeObserverRef.current.observe(node)
  }, [])

  // Charger le layout depuis l'API
  useEffect(() => {
    const loadLayout = async () => {
      try {
        const res = await fetch('/api/v1/dashboard/layout')

        if (res.ok) {
          const json = await res.json()

          if (json.data?.widgets && Array.isArray(json.data.widgets)) {
            setLayout(json.data.widgets)
          }
        }
      } catch (e) {
        console.error('Failed to load layout:', e)

        // Fallback sur localStorage si l'API échoue
        const saved = localStorage.getItem('dashboard-layout')

        if (saved) {
          try {
            setLayout(JSON.parse(saved))
          } catch {}
        }
      } finally {
        setLayoutLoaded(true)
      }
    }

    loadLayout()
  }, [])

  // Sauvegarder le layout via l'API
  const saveLayout = useCallback(async (newLayout) => {
    setLayout(newLayout)

    // Sauvegarder aussi en localStorage comme backup
    localStorage.setItem('dashboard-layout', JSON.stringify(newLayout))

    // Sauvegarder en base via l'API
    setSaving(true)

    try {
      const res = await fetch('/api/v1/dashboard/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets: newLayout })
      })

      if (!res.ok) {
        throw new Error('Failed to save')
      }
    } catch (e) {
      console.error('Failed to save layout:', e)
      setSnackbar({ open: true, message: t('dashboard.saveError'), severity: 'error' })
    } finally {
      setSaving(false)
    }
  }, [t])

  // Convertir notre layout en format react-grid-layout
  const gridLayout = layout.map(w => ({
    i: w.id,
    x: w.x,
    y: w.y,
    w: w.w,
    h: w.h,
    minW: w.minW || 2,
    minH: w.minH || 2,
    maxW: w.maxW || 12,
    maxH: w.maxH || 12,
  }))

  // Handler pour les changements de layout (drag/resize)
  const handleLayoutChange = useCallback((newGridLayout) => {
    if (!editMode) return

    // Mettre à jour notre layout avec les nouvelles positions
    const updatedLayout = layout.map(widget => {
      const gridItem = newGridLayout.find(g => g.i === widget.id)

      if (gridItem) {
        return {
          ...widget,
          x: gridItem.x,
          y: gridItem.y,
          w: gridItem.w,
          h: gridItem.h,
        }
      }

      return widget
    })

    saveLayout(updatedLayout)
  }, [editMode, layout, saveLayout])

  // Ajouter un widget
  const handleAddWidget = (type) => {
    const widgetDef = WIDGET_REGISTRY[type]

    if (!widgetDef) return

    // Trouver une position libre (en bas du layout)
    const maxY = Math.max(...layout.map(w => w.y + w.h), 0)

    const newWidget = {
      id: generateId(),
      type,
      x: 0,
      y: maxY,
      w: widgetDef.defaultSize.w,
      h: widgetDef.defaultSize.h,
      minW: widgetDef.minSize.w,
      minH: widgetDef.minSize.h,
      maxW: widgetDef.maxSize?.w || 12,
      maxH: widgetDef.maxSize?.h || 12,
    }

    saveLayout([...layout, newWidget])
    setAddDialogOpen(false)
    setSnackbar({ open: true, message: t('dashboard.widgetAdded'), severity: 'success' })
  }

  // Supprimer un widget
  const handleRemoveWidget = (id) => {
    saveLayout(layout.filter(w => w.id !== id))
    setSnackbar({ open: true, message: t('dashboard.widgetRemoved'), severity: 'info' })
  }

  // Appliquer un layout prédéfini
  const handleApplyPreset = (presetId) => {
    const preset = PRESET_LAYOUTS[presetId]

    if (preset) {
      saveLayout(preset.widgets.map(w => ({ ...w, id: generateId() })))
      setSnackbar({ open: true, message: t('dashboard.layoutApplied', { name: preset.name }), severity: 'success' })
    }

    setLayoutMenuAnchor(null)
  }

  // Reset layout
  const handleResetLayout = async () => {
    try {
      await fetch('/api/v1/dashboard/layout', { method: 'DELETE' })
      const newLayout = DEFAULT_LAYOUT.map(w => ({ ...w, id: generateId() }))

      setLayout(newLayout)
      localStorage.removeItem('dashboard-layout')
      setSnackbar({ open: true, message: t('dashboard.layoutReset'), severity: 'success' })
    } catch (e) {
      console.error('Failed to reset layout:', e)
    }

    setLayoutMenuAnchor(null)
  }

  if (!layoutLoaded) {
    return (
      <div className='pt-4'>
        <CardsSkeleton count={6} columns={3} />
      </div>
    )
  }

  return (
    <div className='h-full flex flex-col'>
      {/* Toolbar */}
      <div className='flex justify-end gap-2 mb-3 flex-wrap items-center'>
        {saving && (
          <div className='flex items-center gap-2 mr-2'>
            <SpinnerGap size={16} className='animate-spin' style={{ color: 'var(--pc-primary)' }} />
            <span className='text-xs opacity-60'>{t('dashboard.saving')}</span>
          </div>
        )}
        {editMode && (
          <>
            <Button variant='outline' size='small' onClick={() => setAddDialogOpen(true)}>
              <Plus size={14} className='mr-1' />
              {t('dashboard.add')}
            </Button>
            <div className='relative'>
              <Button variant='outline' size='small' onClick={() => setLayoutMenuAnchor(prev => !prev)}>
                {t('dashboard.layouts')}
              </Button>
              {layoutMenuAnchor && (
                <>
                  <div className='fixed inset-0 z-40' onClick={() => setLayoutMenuAnchor(false)} />
                  <div
                    className='absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-lg border shadow-lg py-1'
                    style={{ backgroundColor: 'var(--pc-bg-card)', borderColor: 'var(--pc-border-subtle)' }}
                  >
                    <div className='px-3 py-1.5'>
                      <span className='text-xs font-bold' style={{ color: 'var(--pc-text-muted)' }}>{t('dashboard.presetLayouts')}</span>
                    </div>
                    {Object.values(PRESET_LAYOUTS).map((preset) => (
                      <button
                        key={preset.id}
                        className='w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--pc-bg-subtle)] transition-colors'
                        onClick={() => handleApplyPreset(preset.id)}
                      >
                        {preset.name}
                      </button>
                    ))}
                    <div className='border-t my-1' style={{ borderColor: 'var(--pc-border-subtle)' }} />
                    <button
                      className='w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-[var(--pc-bg-subtle)] transition-colors'
                      style={{ color: 'var(--pc-error)' }}
                      onClick={handleResetLayout}
                    >
                      <ArrowsClockwise size={14} />
                      {t('dashboard.reset')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
        <Tooltip content={editMode ? t('dashboard.finish') : t('dashboard.customize')}>
          <button
            onClick={() => setEditMode(!editMode)}
            className={`p-1.5 rounded-md transition-colors ${
              editMode
                ? 'bg-[var(--pc-primary)] text-white hover:opacity-90'
                : 'hover:bg-[var(--pc-bg-subtle)]'
            }`}
          >
            {editMode ? <Check size={16} /> : <GearSix size={16} />}
          </button>
        </Tooltip>
        {onRefresh && (
          <Tooltip content={t('dashboard.refreshData')}>
            <button
              onClick={onRefresh}
              disabled={refreshLoading}
              className='p-1.5 rounded-md hover:bg-[var(--pc-bg-subtle)] transition-colors disabled:opacity-40'
            >
              <ArrowsClockwise size={16} className={refreshLoading ? 'animate-spin' : ''} />
            </button>
          </Tooltip>
        )}
      </div>

      {/* Grid avec react-grid-layout */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          width: '100%',
          position: 'relative',
        }}
      >
      <style>{`
        .react-grid-item.react-grid-placeholder {
          background-color: var(--pc-primary);
          opacity: 0.2;
          border-radius: 4px;
        }
        .react-grid-item > .react-resizable-handle {
          display: ${editMode ? 'block' : 'none'};
        }
      `}</style>
        <ResponsiveGridLayout
            className="layout"
            style={{ width: '100%' }}
            width={containerWidth}
            layouts={{ lg: gridLayout }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={GRID_COLS}
            rowHeight={ROW_HEIGHT}
            margin={MARGIN}
            isDraggable={editMode}
            isResizable={editMode}
            draggableHandle=".widget-drag-handle"
            onLayoutChange={(newLayout) => handleLayoutChange(newLayout)}
            useCSSTransforms={true}
            compactType="vertical"
          >
          {layout.map((config) => (
            <div key={config.id}>
              <WidgetContainer
                config={config}
                data={data}
                loading={loading}
                editMode={editMode}
                onRemove={() => handleRemoveWidget(config.id)}
                t={t}
              />
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>

      {/* Add Widget Dialog */}
      <AddWidgetDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdd={handleAddWidget}
        t={t}
      />

      {/* Toast notification */}
      {snackbar.open && (
        <div className='fixed bottom-4 right-4 z-50'>
          <Surface
            className={`px-4 py-3 rounded-lg border shadow-lg flex items-center gap-3 ${
              snackbar.severity === 'error' ? 'border-[var(--pc-error)]' : 'border-[var(--pc-border-subtle)]'
            }`}
            style={{ backgroundColor: 'var(--pc-bg-card)' }}
          >
            <span className='text-sm'>{snackbar.message}</span>
            <button
              onClick={() => setSnackbar({ ...snackbar, open: false })}
              className='p-0.5 rounded hover:bg-[var(--pc-border-subtle)]'
            >
              <X size={14} />
            </button>
          </Surface>
        </div>
      )}
    </div>
  )
}
