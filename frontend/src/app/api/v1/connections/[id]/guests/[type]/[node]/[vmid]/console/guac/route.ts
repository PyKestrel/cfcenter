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

  // Must use 'binary' encoding to match guacamole-lite's Crypt.js decrypt()
  let encrypted = cipher.update(JSON.stringify(tokenObject), 'utf8', 'binary')

  encrypted += cipher.final('binary')

  const data = {
    iv: iv.toString('base64'),
    value: Buffer.from(encrypted, 'binary').toString('base64'),
  }

  return Buffer.from(JSON.stringify(data)).toString('base64')
}

const APP_PORT = process.env.PORT || 3000
const INTERNAL_API_URL = `http://localhost:${APP_PORT}`

/**
 * POST /api/v1/connections/{id}/guests/{type}/{node}/{vmid}/console/guac
 *
 * Creates a VNC proxy session with Proxmox and returns an encrypted token
 * for guacamole-lite. The browser uses this token to connect via WebSocket
 * to /ws/guac/?token=<token>.
 *
 * Architecture:
 *   Browser → WebSocket → guacamole-lite → TCP → guacd → TCP → VNC relay
 *   VNC relay → WebSocket → Proxmox vncwebsocket
 *
 * We use websocket=1 with Proxmox and create a local TCP relay (via internal API)
 * so guacd can reach the VNC stream. Proxmox VNC ports are only accessible via
 * the WebSocket API, not as raw TCP.
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
    // Get VNC proxy ticket from Proxmox (websocket=1 for WebSocket VNC)
    const data = await pveFetch<any>(
      conn,
      `/nodes/${encodeURIComponent(node)}/${encodeURIComponent(type)}/${encodeURIComponent(vmid)}/vncproxy`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "websocket=1",
      }
    )

    // Create a local TCP relay via internal API (vnc-relay.js runs in start.js process)
    // This bridges Proxmox's WebSocket VNC to a local TCP port that guacd can connect to
    const relayRes = await fetch(`${INTERNAL_API_URL}/api/internal/vnc-relay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseUrl: conn.baseUrl,
        node,
        type,
        vmid,
        port: data.port,
        ticket: data.ticket,
        apiToken: conn.apiToken || undefined,
      }),
    })

    if (!relayRes.ok) {
      const errText = await relayRes.text()

      throw new Error(`Failed to create VNC relay: ${errText}`)
    }

    const relay = await relayRes.json()

    // Create encrypted token for guacamole-lite
    // guacd connects to the frontend container's relay port via Docker network
    const containerName = process.env.CFCENTER_CONTAINER_NAME || "cfcenter-frontend"

    const token = encryptToken({
      connection: {
        type: "vnc",
        settings: {
          hostname: containerName,
          port: String(relay.relayPort),
          security: "none",
          "ignore-cert": true,
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
        relayId: relay.relayId,
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
