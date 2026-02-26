// src/app/api/v1/templates/route.ts
// CRUD API for VM templates

import { NextRequest, NextResponse } from 'next/server'

import { checkPermission, PERMISSIONS } from '@/lib/rbac'
import { listTemplates, createTemplate } from '@/lib/templates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/v1/templates — List all templates
export async function GET(request: NextRequest) {
  try {
    const denied = await checkPermission(PERMISSIONS.VM_VIEW, 'global', '*')

    if (denied) return denied

    const category = request.nextUrl.searchParams.get('category') || undefined
    const type = request.nextUrl.searchParams.get('type') || undefined
    const builtinParam = request.nextUrl.searchParams.get('builtin')
    const is_builtin = builtinParam === null ? undefined : builtinParam === 'true'

    const templates = listTemplates({ category, type, is_builtin })

    return NextResponse.json({ data: templates, total: templates.length })
  } catch (e: any) {
    console.error('[templates] GET error:', e)

    return NextResponse.json({ error: e?.message || 'Failed to list templates' }, { status: 500 })
  }
}

// POST /api/v1/templates — Create a new template
export async function POST(request: NextRequest) {
  try {
    const denied = await checkPermission(PERMISSIONS.VM_CONFIG, 'global', '*')

    if (denied) return denied

    const body = await request.json()
    const { name, description, category, icon, type, config, metadata } = body

    if (!name || !type || !config) {
      return NextResponse.json({ error: 'Missing required fields: name, type, config' }, { status: 400 })
    }

    if (type !== 'qemu' && type !== 'lxc') {
      return NextResponse.json({ error: "Type must be 'qemu' or 'lxc'" }, { status: 400 })
    }

    const template = createTemplate({ name, description, category, icon, type, config, metadata })

    return NextResponse.json({ data: template }, { status: 201 })
  } catch (e: any) {
    console.error('[templates] POST error:', e)

    return NextResponse.json({ error: e?.message || 'Failed to create template' }, { status: 500 })
  }
}
