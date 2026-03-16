// Read VM clipboard via QEMU Guest Agent
// Uses exec to run xclip/xsel (Linux) or PowerShell Get-Clipboard (Windows)
import { NextRequest, NextResponse } from 'next/server'

import { pveFetch } from '@/lib/proxmox/client'
import { getConnectionById } from '@/lib/connections/getConnection'
import { checkPermission, buildVmResourceId, PERMISSIONS } from '@/lib/rbac'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string; type: string; node: string; vmid: string }>
}

async function guestExec(
  conn: any,
  node: string,
  vmType: string,
  vmid: string,
  command: string,
  args: string[] = [],
): Promise<{ exitcode: number; outData: string; errData: string }> {
  const basePath = `/nodes/${encodeURIComponent(node)}/${encodeURIComponent(vmType)}/${encodeURIComponent(vmid)}`

  const params = new URLSearchParams({ command })

  for (let i = 0; i < args.length; i++) {
    params.append(`arg${i}`, args[i])
  }

  const execResult = await pveFetch<any>(conn, `${basePath}/agent/exec`, {
    method: 'POST',
    body: params,
  })

  const pid = execResult?.pid

  if (pid === undefined) throw new Error('Failed to start command on guest')

  // Poll for completion (up to 10 seconds)
  for (let i = 0; i < 20; i++) {
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

  throw new Error('Command timed out')
}

async function detectOs(conn: any, node: string, vmType: string, vmid: string): Promise<'linux' | 'windows'> {
  try {
    const basePath = `/nodes/${encodeURIComponent(node)}/${encodeURIComponent(vmType)}/${encodeURIComponent(vmid)}`
    const osInfo = await pveFetch<any>(conn, `${basePath}/agent/get-osinfo`)
    const result = osInfo?.result || osInfo
    const id = (result?.id || '').toLowerCase()
    const name = (result?.name || result?.['pretty-name'] || '').toLowerCase()

    if (id === 'mswindows' || name.includes('windows')) return 'windows'

    return 'linux'
  } catch {
    return 'linux'
  }
}

/**
 * GET /api/v1/connections/[id]/guests/[type]/[node]/[vmid]/clipboard
 * Read the VM's clipboard content via QEMU Guest Agent
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id, type, node, vmid } = await ctx.params

    if (!id || !type || !node || !vmid) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    if (type !== 'qemu') {
      return NextResponse.json({ error: 'Clipboard read requires QEMU guest agent' }, { status: 400 })
    }

    const resourceId = buildVmResourceId(id, node, type, vmid)
    const denied = await checkPermission(PERMISSIONS.VM_CONSOLE, 'vm', resourceId)

    if (denied) return denied

    const conn = await getConnectionById(id)
    const os = await detectOs(conn, node, type, vmid)

    let content = ''

    if (os === 'windows') {
      // Windows: PowerShell Get-Clipboard
      const result = await guestExec(conn, node, type, vmid, 'powershell.exe', ['-Command', 'Get-Clipboard'])

      if (result.exitcode === 0) {
        content = result.outData.replace(/\r\n$/, '')
      } else {
        return NextResponse.json({
          error: `Failed to read clipboard: ${result.errData || result.outData}`,
        }, { status: 400 })
      }
    } else {
      // Linux: try xclip first, then xsel, then wl-paste (Wayland)
      // Most VMs with a desktop will have at least one of these
      let result = null
      const commands = [
        { cmd: 'xclip', args: ['-selection', 'clipboard', '-o'] },
        { cmd: 'xsel', args: ['--clipboard', '--output'] },
        { cmd: 'wl-paste', args: [] },
      ]

      for (const { cmd, args } of commands) {
        try {
          result = await guestExec(conn, node, type, vmid, cmd, args)

          if (result.exitcode === 0) {
            content = result.outData
            break
          }
        } catch {
          // Command not found or not available, try next
          continue
        }
      }

      if (result === null || result.exitcode !== 0) {
        return NextResponse.json({
          error: 'Could not read clipboard. Ensure xclip, xsel, or wl-paste is installed on the VM.',
        }, { status: 400 })
      }
    }

    return NextResponse.json({ data: { content, os } })
  } catch (e: any) {
    console.error('[clipboard] Error:', e)

    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
