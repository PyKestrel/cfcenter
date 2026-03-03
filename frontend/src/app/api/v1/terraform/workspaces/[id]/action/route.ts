// src/app/api/v1/terraform/workspaces/[id]/action/route.ts
import { NextRequest, NextResponse } from 'next/server'

import {
  getWorkspace,
  runTerraformAction,
  getOperationLogs,
  isTerraformInstalled,
} from '@/lib/terraform'
import type { TerraformAction } from '@/lib/terraform'
import { getCredentialConfig } from '@/lib/terraform/credentials'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/v1/terraform/workspaces/[id]/action — run terraform action (init/plan/apply/destroy)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action, api_token } = body as { action: TerraformAction; api_token?: string }

    if (!action || !['init', 'plan', 'apply', 'destroy', 'validate'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be: init, plan, apply, destroy, or validate' }, { status: 400 })
    }

    if (!isTerraformInstalled()) {
      return NextResponse.json({
        error: 'Terraform is not installed on this server. Install from: https://developer.hashicorp.com/terraform/install',
      }, { status: 503 })
    }

    const ws = getWorkspace(id)

    if (!ws) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    if (ws.status !== 'idle' && ws.status !== 'error') {
      return NextResponse.json({ error: `Workspace is busy (status: ${ws.status})` }, { status: 409 })
    }

    if (!ws.hcl_content.trim()) {
      return NextResponse.json({ error: 'Workspace has no HCL content' }, { status: 400 })
    }

    // Resolve credentials: stored credential > manual api_token
    let envOverrides: Record<string, string> = {}

    if (ws.credential_id) {
      const config = getCredentialConfig(ws.credential_id)

      if (config) {
        // Map credential config to TF env vars based on provider
        if (config.api_token) envOverrides.TF_VAR_proxmox_api_token = String(config.api_token)
        if (config.access_key) envOverrides.AWS_ACCESS_KEY_ID = String(config.access_key)
        if (config.secret_key) envOverrides.AWS_SECRET_ACCESS_KEY = String(config.secret_key)
        if (config.region && !config.api_token) envOverrides.AWS_DEFAULT_REGION = String(config.region)
        if (config.client_id) envOverrides.ARM_CLIENT_ID = String(config.client_id)
        if (config.client_secret) envOverrides.ARM_CLIENT_SECRET = String(config.client_secret)
        if (config.subscription_id) envOverrides.ARM_SUBSCRIPTION_ID = String(config.subscription_id)
        if (config.tenant_id) envOverrides.ARM_TENANT_ID = String(config.tenant_id)
        if (config.credentials_json) envOverrides.GOOGLE_CREDENTIALS = String(config.credentials_json)
        if (config.project) envOverrides.GOOGLE_PROJECT = String(config.project)
        if (config.server) envOverrides.VSPHERE_SERVER = String(config.server)
        if (config.user) envOverrides.VSPHERE_USER = String(config.user)
        if (config.password) envOverrides.VSPHERE_PASSWORD = String(config.password)

        // Custom provider: parse env_vars (KEY=VALUE per line)
        if (config.env_vars && typeof config.env_vars === 'string') {
          for (const line of String(config.env_vars).split('\n')) {
            const eq = line.indexOf('=')

            if (eq > 0) {
              envOverrides[line.substring(0, eq).trim()] = line.substring(eq + 1).trim()
            }
          }
        }
      }
    } else if (api_token) {
      // Fallback: manual token from request
      envOverrides.TF_VAR_proxmox_api_token = api_token
    }

    // Run terraform action (async — returns when complete)
    const operation = await runTerraformAction(id, action, Object.keys(envOverrides).length > 0 ? envOverrides : undefined)

    return NextResponse.json({ data: operation })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET /api/v1/terraform/workspaces/[id]/action?op_id=xxx — get live logs for an operation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url)
    const opId = searchParams.get('op_id')

    if (!opId) {
      return NextResponse.json({ error: 'op_id query parameter is required' }, { status: 400 })
    }

    const logs = getOperationLogs(opId)

    return NextResponse.json({ logs })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
