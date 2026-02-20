import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || "http://localhost:8080"

// Default license status when orchestrator is unavailable — all features unlocked
const DEFAULT_COMMUNITY_STATUS = {
  licensed: true,
  expired: false,
  edition: 'enterprise',
  features: [
    'dashboard', 'inventory', 'backups', 'storage',
    'drs', 'firewall', 'microsegmentation', 'rolling_updates',
    'ai_insights', 'predictive_alerts', 'alerts', 'green_metrics',
    'cross_cluster_migration', 'ceph_replication', 'ldap', 'reports',
    'rbac', 'task_center', 'notifications', 'cve_scanner',
  ],
}

export async function GET() {
  try {
    const res = await fetch(`${ORCHESTRATOR_URL}/api/v1/license/status`, {
      cache: "no-store",
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error || `HTTP ${res.status}` },
        { status: res.status }
      )
    }

    return NextResponse.json(data)
  } catch (e: any) {
    // Return default community license when orchestrator is unavailable (silent)
    if (e?.message?.includes('ECONNREFUSED') ||
        e?.message?.includes('fetch failed') ||
        e?.message?.includes('timeout')) {
      return NextResponse.json(DEFAULT_COMMUNITY_STATUS)
    }

    // Log only unexpected errors
    console.error("License status fetch failed:", e?.message)

    return NextResponse.json(
      { error: e?.message || "Failed to fetch license status" },
      { status: 500 }
    )
  }
}
