// src/app/api/v1/terraform/workspaces/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'

import {
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  listOperations,
} from '@/lib/terraform'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/v1/terraform/workspaces/[id] — get workspace + history
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ws = getWorkspace(id)

    if (!ws) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const operations = listOperations(id, 50)

    return NextResponse.json({ data: ws, operations })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/v1/terraform/workspaces/[id] — update workspace
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description, hcl_content, connection_id } = body

    const ws = updateWorkspace(id, {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(hcl_content !== undefined && { hcl_content }),
      ...(connection_id !== undefined && { connection_id }),
    })

    if (!ws) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    return NextResponse.json({ data: ws })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/v1/terraform/workspaces/[id] — delete workspace
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ok = deleteWorkspace(id)

    if (!ok) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
