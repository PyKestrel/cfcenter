// src/app/api/v1/connections/[id]/guests/[type]/[node]/[vmid]/files/route.ts
// File Explorer API — List directory, read file, write file via QEMU Guest Agent
import { NextRequest, NextResponse } from 'next/server'

import { pveFetch } from '@/lib/proxmox/client'
import { getConnectionById } from '@/lib/connections/getConnection'
import { checkPermission, buildVmResourceId, PERMISSIONS } from '@/lib/rbac'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string; type: string; node: string; vmid: string }>
}

// Helper: exec a command via guest agent and wait for result
async function guestExec(
  conn: any,
  node: string,
  type: string,
  vmid: string,
  command: string,
  args: string[] = [],
  inputData?: string,
): Promise<{ exitcode: number; outData: string; errData: string }> {
  const basePath = `/nodes/${encodeURIComponent(node)}/${encodeURIComponent(type)}/${encodeURIComponent(vmid)}`

  // PVE 8+ uses repeated `command` keys as an array: command=exe&command=arg1&command=arg2
  const params = new URLSearchParams()
  params.append('command', command)

  for (const arg of args) {
    params.append('command', arg)
  }

  if (inputData) {
    params.append('input-data', inputData)
  }

  const execResult = await pveFetch<any>(conn, `${basePath}/agent/exec`, {
    method: 'POST',
    body: params,
  })

  const pid = execResult?.pid
  if (pid === undefined) throw new Error('Failed to start command on guest')

  // Poll for completion (up to 15 seconds)
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 500))

    const status = await pveFetch<any>(conn, `${basePath}/agent/exec-status?pid=${pid}`)

    if (status?.exited) {
      return {
        exitcode: status.exitcode ?? -1,
        outData: status['out-data'] || '',
        errData: status['err-data'] || '',
      }
    }
  }

  throw new Error('Command timed out after 15 seconds')
}

// Helper: detect OS type
async function detectOs(conn: any, node: string, type: string, vmid: string): Promise<'linux' | 'windows'> {
  try {
    const basePath = `/nodes/${encodeURIComponent(node)}/${encodeURIComponent(type)}/${encodeURIComponent(vmid)}`
    const osInfo = await pveFetch<any>(conn, `${basePath}/agent/get-osinfo`)
    const result = osInfo?.result || osInfo
    const id = (result?.id || '').toLowerCase()
    const name = (result?.name || result?.['pretty-name'] || '').toLowerCase()

    if (id === 'mswindows' || name.includes('windows')) return 'windows'

    return 'linux'
  } catch {
    return 'linux' // default to linux
  }
}

// Parse ls -la output into file entries
function parseLsOutput(raw: string, currentPath: string): any[] {
  const lines = raw.split('\n').filter(l => l.trim())
  const files: any[] = []

  for (const line of lines) {
    // Skip total line and header
    if (line.startsWith('total ') || line.startsWith('Total ')) continue

    // Match ls -la format: permissions links owner group size month day time/year name
    const match = line.match(
      /^([drwxlsStT\-]{10})\s+(\d+)\s+(\S+)\s+(\S+)\s+(\d+)\s+(\w+\s+\d+\s+[\d:]+)\s+(.+)$/
    )

    if (match) {
      const [, perms, , owner, group, sizeStr, date, name] = match

      // Skip . entry
      if (name === '.') continue

      const isDir = perms.startsWith('d')
      const isLink = perms.startsWith('l')
      let displayName = name
      let linkTarget = undefined

      if (isLink && name.includes(' -> ')) {
        const parts = name.split(' -> ')
        displayName = parts[0]
        linkTarget = parts[1]
      }

      files.push({
        name: displayName,
        path: currentPath === '/' ? `/${displayName}` : `${currentPath}/${displayName}`,
        type: isDir ? 'directory' : isLink ? 'symlink' : 'file',
        size: parseInt(sizeStr, 10),
        permissions: perms,
        owner,
        group,
        modified: date.trim(),
        linkTarget,
      })
    }
  }

  return files
}

// Parse Windows dir output into file entries
function parseDirOutput(raw: string, currentPath: string): any[] {
  const lines = raw.split('\n').filter(l => l.trim())
  const files: any[] = []

  for (const line of lines) {
    // Match: MM/DD/YYYY  HH:MM AM/PM    <DIR>          name
    // Match: MM/DD/YYYY  HH:MM AM/PM         size name
    const match = line.match(
      /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}\s+[AP]M)\s+(<DIR>|\S+)\s+(.+)$/
    )

    if (match) {
      const [, date, time, sizeOrDir, name] = match

      if (name === '.' || name === '..') continue

      const isDir = sizeOrDir === '<DIR>'
      const sep = currentPath.endsWith('\\') ? '' : '\\'

      files.push({
        name,
        path: `${currentPath}${sep}${name}`,
        type: isDir ? 'directory' : 'file',
        size: isDir ? 0 : parseInt(sizeOrDir.replace(/,/g, ''), 10) || 0,
        permissions: null,
        owner: null,
        group: null,
        modified: `${date} ${time}`,
      })
    }
  }

  return files
}

/**
 * GET /api/v1/connections/[id]/guests/[type]/[node]/[vmid]/files?path=/some/dir
 * List directory contents via guest agent
 */
export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const { id, type, node, vmid } = await ctx.params

    if (!id || !type || !node || !vmid) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    if (type !== 'qemu') {
      return NextResponse.json({ error: 'File operations require QEMU guest agent (not available for LXC)' }, { status: 400 })
    }

    const resourceId = buildVmResourceId(id, node, type, vmid)
    const denied = await checkPermission(PERMISSIONS.VM_VIEW, 'vm', resourceId)
    if (denied) return denied

    const conn = await getConnectionById(id)
    const dirPath = req.nextUrl.searchParams.get('path') || '/'

    // Detect OS
    const os = await detectOs(conn, node, type, vmid)

    let files: any[]

    if (os === 'windows') {
      const winPath = dirPath === '/' ? 'C:\\' : dirPath
      const result = await guestExec(conn, node, type, vmid, 'cmd.exe', ['/c', `dir "${winPath}"`])

      if (result.exitcode !== 0) {
        return NextResponse.json({ error: `Directory listing failed: ${result.errData || result.outData}` }, { status: 400 })
      }

      files = parseDirOutput(result.outData, winPath)
    } else {
      const result = await guestExec(conn, node, type, vmid, 'ls', ['-la', dirPath])

      if (result.exitcode !== 0) {
        return NextResponse.json({ error: `Directory listing failed: ${result.errData || result.outData}` }, { status: 400 })
      }

      files = parseLsOutput(result.outData, dirPath)
    }

    return NextResponse.json({ data: { path: dirPath, os, files } })
  } catch (e: any) {
    console.error('[files] Error:', e)

    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

/**
 * POST /api/v1/connections/[id]/guests/[type]/[node]/[vmid]/files
 * Upload/write a file to the VM via guest agent
 * Body: { path: string, content: string (base64) }
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const { id, type, node, vmid } = await ctx.params

    if (!id || !type || !node || !vmid) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    if (type !== 'qemu') {
      return NextResponse.json({ error: 'File operations require QEMU guest agent' }, { status: 400 })
    }

    const resourceId = buildVmResourceId(id, node, type, vmid)
    const denied = await checkPermission(PERMISSIONS.VM_CONFIG, 'vm', resourceId)
    if (denied) return denied

    const conn = await getConnectionById(id)
    const body = await req.json()
    const { path: filePath, content } = body

    if (!filePath || !content) {
      return NextResponse.json({ error: 'Missing path or content' }, { status: 400 })
    }

    const basePath = `/nodes/${encodeURIComponent(node)}/${encodeURIComponent(type)}/${encodeURIComponent(vmid)}`

    // Write file via guest agent file-write
    await pveFetch<any>(conn, `${basePath}/agent/file-write`, {
      method: 'POST',
      body: new URLSearchParams({
        file: filePath,
        content,
        encode: 'base64',
      }),
    })

    return NextResponse.json({ data: { success: true, path: filePath } })
  } catch (e: any) {
    console.error('[files] Upload error:', e)

    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
