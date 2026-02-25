import net from "net"

import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const GUACD_HOST = process.env.GUACD_HOST || "guacd"
const GUACD_PORT = parseInt(process.env.GUACD_PORT || "4822", 10)

/**
 * GET /api/internal/guacd/health
 *
 * Checks if guacd (Apache Guacamole daemon) is reachable.
 * Returns { available: true/false, host, port }
 */
export async function GET() {
  const available = await checkGuacd()

  return NextResponse.json({
    available,
    host: GUACD_HOST,
    port: GUACD_PORT,
  })
}

function checkGuacd(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()

    socket.setTimeout(3000)

    socket.on("connect", () => {
      socket.destroy()
      resolve(true)
    })

    socket.on("timeout", () => {
      socket.destroy()
      resolve(false)
    })

    socket.on("error", () => {
      socket.destroy()
      resolve(false)
    })

    socket.connect(GUACD_PORT, GUACD_HOST)
  })
}
