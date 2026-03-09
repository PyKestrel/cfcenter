// src/app/api/v1/connections/[id]/guests/[type]/[node]/[vmid]/files/download/route.ts
// Download a file from the VM via QEMU Guest Agent file-read
import { NextRequest, NextResponse } from 'next/server'

import { pveFetch } from '@/lib/proxmox/client'
import { getConnectionById } from '@/lib/connections/getConnection'
import { checkPermission, buildVmResourceId, PERMISSIONS } from '@/lib/rbac'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string; type: string; node: string; vmid: string }>
}

/**
 * GET /api/v1/connections/[id]/guests/[type]/[node]/[vmid]/files/download?path=/etc/hosts
 * Read/download a file from the VM via guest agent
 */
export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const { id, type, node, vmid } = await ctx.params

    if (!id || !type || !node || !vmid) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    if (type !== 'qemu') {
      return NextResponse.json({ error: 'File operations require QEMU guest agent' }, { status: 400 })
    }

    const resourceId = buildVmResourceId(id, node, type, vmid)
    const denied = await checkPermission(PERMISSIONS.VM_VIEW, 'vm', resourceId)
    if (denied) return denied

    const conn = await getConnectionById(id)
    const filePath = req.nextUrl.searchParams.get('path')

    if (!filePath) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 })
    }

    const basePath = `/nodes/${encodeURIComponent(node)}/${encodeURIComponent(type)}/${encodeURIComponent(vmid)}`

    // Read file via guest agent
    const result = await pveFetch<any>(conn, `${basePath}/agent/file-read?file=${encodeURIComponent(filePath)}`)

    // Result contains: { content: string (base64), truncated?: boolean }
    const content = result?.content || ''
    const truncated = result?.truncated || false

    // Determine filename from path
    const filename = filePath.split('/').pop() || filePath.split('\\').pop() || 'download'

    // Check if client wants raw download or JSON preview
    const mode = req.nextUrl.searchParams.get('mode') || 'download'

    if (mode === 'preview') {
      // Return as JSON for preview (decode base64 to text)
      let textContent: string
      try {
        textContent = Buffer.from(content, 'base64').toString('utf-8')
      } catch {
        textContent = '[Binary content - cannot preview]'
      }

      return NextResponse.json({
        data: {
          path: filePath,
          filename,
          content: textContent,
          truncated,
          size: Buffer.from(content, 'base64').length,
        },
      })
    }

    // Return as downloadable binary
    const buffer = Buffer.from(content, 'base64')

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
        ...(truncated ? { 'X-Truncated': 'true' } : {}),
      },
    })
  } catch (e: any) {
    console.error('[files/download] Error:', e)

    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
