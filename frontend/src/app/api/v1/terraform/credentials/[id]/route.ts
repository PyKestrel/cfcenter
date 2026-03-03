// src/app/api/v1/terraform/credentials/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'

import {
  getCredentialSafe,
  updateCredential,
  deleteCredential,
  PROVIDER_SCHEMAS,
} from '@/lib/terraform/credentials'
import type { TerraformProvider } from '@/lib/terraform/credentials'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/v1/terraform/credentials/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cred = getCredentialSafe(id)

    if (!cred) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
    }

    return NextResponse.json({ data: cred })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/v1/terraform/credentials/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description, provider, config } = body

    const updates: Parameters<typeof updateCredential>[1] = {}

    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (provider !== undefined) {
      if (!PROVIDER_SCHEMAS[provider as TerraformProvider]) {
        return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
      }

      updates.provider = provider
    }

    if (config !== undefined) updates.config = config

    const cred = updateCredential(id, updates)

    if (!cred) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
    }

    return NextResponse.json({ data: cred })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/v1/terraform/credentials/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ok = deleteCredential(id)

    if (!ok) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
