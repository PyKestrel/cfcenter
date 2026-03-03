// src/app/api/v1/terraform/credentials/route.ts
import { NextRequest, NextResponse } from 'next/server'

import {
  listCredentials,
  createCredential,
  PROVIDER_SCHEMAS,
} from '@/lib/terraform/credentials'
import type { TerraformProvider } from '@/lib/terraform/credentials'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/v1/terraform/credentials — list all credentials (safe/masked)
export async function GET() {
  try {
    const credentials = listCredentials()
    const providers = Object.entries(PROVIDER_SCHEMAS).map(([key, val]) => ({
      id: key,
      label: val.label,
      icon: val.icon,
      fields: val.fields,
    }))

    return NextResponse.json({ data: credentials, providers })
  } catch (error: any) {
    console.error('Error listing terraform credentials:', error)

    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/v1/terraform/credentials — create a new credential
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, provider, description, config } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!provider || !PROVIDER_SCHEMAS[provider as TerraformProvider]) {
      return NextResponse.json({ error: `Invalid provider. Must be one of: ${Object.keys(PROVIDER_SCHEMAS).join(', ')}` }, { status: 400 })
    }

    if (!config || typeof config !== 'object') {
      return NextResponse.json({ error: 'Config object is required' }, { status: 400 })
    }

    // Validate required fields
    const schema = PROVIDER_SCHEMAS[provider as TerraformProvider]

    for (const field of schema.fields) {
      if (field.required && !config[field.key] && config[field.key] !== false) {
        return NextResponse.json({ error: `Field '${field.label}' is required for ${schema.label}` }, { status: 400 })
      }
    }

    const cred = createCredential({
      name: name.trim(),
      provider: provider as TerraformProvider,
      description: description || undefined,
      config,
    })

    return NextResponse.json({ data: cred }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating terraform credential:', error)

    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
