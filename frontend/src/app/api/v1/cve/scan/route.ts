// src/app/api/v1/cve/scan/route.ts
// Standalone CVE scanner API — no orchestrator dependency

import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db/prisma'
import { decryptSecret } from '@/lib/crypto/secret'
import {
  scanConnection,
  getLatestVulnerabilities,
  getScanSummary,
  getLatestScanResults,
  clearScanHistory,
  initCveTables,
} from '@/lib/cve/scanner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/v1/cve/scan — get latest scan results & summary
export async function GET(request: NextRequest) {
  try {
    initCveTables()
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connection_id') || undefined

    const summary = getScanSummary(connectionId)
    const vulnerabilities = getLatestVulnerabilities(connectionId)
    const scans = getLatestScanResults(connectionId, 20)

    return NextResponse.json({
      data: {
        summary,
        vulnerabilities,
        scans,
        lastScan: summary.last_scan_at,
      },
    })
  } catch (error: any) {
    console.error('Error fetching CVE data:', error)

    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/v1/cve/scan — trigger a new scan across all connections
export async function POST(request: NextRequest) {
  try {
    initCveTables()
    const body = await request.json().catch(() => ({}))
    const targetConnectionId = body.connection_id as string | undefined

    // Get all PVE connections (or specific one)
    const where: any = { type: 'pve' }

    if (targetConnectionId) where.id = targetConnectionId

    const connections = await prisma.connection.findMany({
      where,
      select: {
        id: true,
        name: true,
        baseUrl: true,
        insecureTLS: true,
        apiTokenEnc: true,
      },
    })

    if (connections.length === 0) {
      return NextResponse.json({ error: 'No PVE connections found' }, { status: 404 })
    }

    const allResults: any[] = []
    const errors: string[] = []

    for (const connection of connections) {
      if (!connection.apiTokenEnc) {
        errors.push(`${connection.name}: No API token configured`)
        continue
      }

      const conn = {
        id: connection.id,
        name: connection.name,
        baseUrl: connection.baseUrl,
        apiToken: decryptSecret(connection.apiTokenEnc),
        insecureDev: !!connection.insecureTLS,
      }

      try {
        const results = await scanConnection(conn)

        allResults.push(...results)
      } catch (err: any) {
        errors.push(`${connection.name}: ${err.message}`)
      }
    }

    const summary = getScanSummary(targetConnectionId)
    const vulnerabilities = getLatestVulnerabilities(targetConnectionId)

    return NextResponse.json({
      data: {
        summary,
        vulnerabilities,
        scans: allResults,
        errors: errors.length > 0 ? errors : undefined,
        lastScan: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error('Error scanning CVEs:', error)

    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/v1/cve/scan — clear scan history
export async function DELETE(request: NextRequest) {
  try {
    initCveTables()
    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connection_id') || undefined

    clearScanHistory(connectionId)

    return NextResponse.json({ data: { cleared: true } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
