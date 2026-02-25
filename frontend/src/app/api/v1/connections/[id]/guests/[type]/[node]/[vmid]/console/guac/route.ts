import crypto from "crypto"

import { NextResponse } from "next/server"

import { pveFetch } from "@/lib/proxmox/client"
import { getConnectionById } from "@/lib/connections/getConnection"
import { checkPermission, buildVmResourceId, PERMISSIONS } from "@/lib/rbac"

export const runtime = "nodejs"

// Derive encryption key from APP_SECRET (must match guacd-proxy.js)
const APP_SECRET = process.env.APP_SECRET || process.env.NEXTAUTH_SECRET || 'cfcenter-dev-secret-key-change-me'

const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(APP_SECRET)
  .digest()
  .subarray(0, 32)

const CIPHER = 'aes-256-cbc'

function encryptToken(tokenObject: object): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(CIPHER, ENCRYPTION_KEY, iv)

  let encrypted = cipher.update(JSON.stringify(tokenObject), 'utf8', 'base64')

  encrypted += cipher.final('base64')

  const data = {
    iv: iv.toString('base64'),
    value: encrypted,
  }

  return Buffer.from(JSON.stringify(data)).toString('base64')
}

/**
 * POST /api/v1/connections/{id}/guests/{type}/{node}/{vmid}/console/guac
 *
 * Creates a VNC proxy session with Proxmox and returns an encrypted token
 * for guacamole-lite. The browser uses this token to connect via WebSocket
 * to /ws/guac/?token=<token>.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; type: string; node: string; vmid: string }> }
) {
  const { id, type, node, vmid } = await ctx.params

  // RBAC: Check vm.console permission
  const resourceId = buildVmResourceId(id, node, type, vmid)

  const denied = await checkPermission(PERMISSIONS.VM_CONSOLE, "vm", resourceId)

  if (denied) return denied

  const conn = await getConnectionById(id)

  if (!conn) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 })
  }

  try {
    // Get VNC proxy ticket from Proxmox
    const data = await pveFetch<any>(
      conn,
      `/nodes/${encodeURIComponent(node)}/${encodeURIComponent(type)}/${encodeURIComponent(vmid)}/vncproxy`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "websocket=0", // guacd connects via native VNC, not WebSocket
      }
    )

    // Extract Proxmox host from connection URL
    const pveUrl = new URL(conn.baseUrl)

    // Create encrypted token for guacamole-lite
    // guacd will connect directly to the Proxmox VNC port using native VNC protocol
    const token = encryptToken({
      connection: {
        type: "vnc",
        settings: {
          hostname: pveUrl.hostname,
          port: String(data.port),
          password: data.ticket,
          "enable-audio": false,
          "cursor": "remote",
          "color-depth": 24,
        },
      },
    })

    return NextResponse.json({
      data: {
        token,
        wsPath: `/ws/guac/?token=${encodeURIComponent(token)}`,
        port: data.port,
      },
    })
  } catch (err: any) {
    console.error("[guac-console] Error creating session:", err)

    return NextResponse.json(
      { error: err.message || "Failed to create Guacamole session" },
      { status: 500 }
    )
  }
}
