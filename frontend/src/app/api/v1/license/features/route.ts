import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || "http://localhost:8080"

// Default features when orchestrator is unavailable — all features unlocked
const DEFAULT_COMMUNITY_FEATURES = {
  features: [
    { id: 'dashboard', name: 'Dashboard', enabled: true },
    { id: 'inventory', name: 'Inventory', enabled: true },
    { id: 'backups', name: 'Backups', enabled: true },
    { id: 'storage', name: 'Storage', enabled: true },
    { id: 'drs', name: 'DRS', enabled: true },
    { id: 'firewall', name: 'Firewall', enabled: true },
    { id: 'microsegmentation', name: 'Microsegmentation', enabled: true },
    { id: 'rolling_updates', name: 'Rolling Updates', enabled: true },
    { id: 'ai_insights', name: 'AI Insights', enabled: true },
    { id: 'predictive_alerts', name: 'Predictive Alerts', enabled: true },
    { id: 'green_metrics', name: 'Green Metrics', enabled: true },
    { id: 'cross_cluster_migration', name: 'Cross Cluster Migration', enabled: true },
    { id: 'ceph_replication', name: 'Ceph Replication', enabled: true },
    { id: 'ldap', name: 'LDAP', enabled: true },
    { id: 'reports', name: 'Reports', enabled: true },
    { id: 'rbac', name: 'RBAC', enabled: true },
    { id: 'task_center', name: 'Task Center', enabled: true },
    { id: 'notifications', name: 'Notifications', enabled: true },
    { id: 'cve_scanner', name: 'CVE Scanner', enabled: true },
  ]
}

export async function GET() {
  try {
    const res = await fetch(`${ORCHESTRATOR_URL}/api/v1/license/features`, {
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
    console.error("License features fetch failed:", e?.message)

    // Return default community features when orchestrator is unavailable
    if (e?.message?.includes('ECONNREFUSED') ||
        e?.message?.includes('fetch failed') ||
        e?.message?.includes('timeout')) {
      return NextResponse.json(DEFAULT_COMMUNITY_FEATURES)
    }

    return NextResponse.json(
      { error: e?.message || "Failed to fetch license features" },
      { status: 500 }
    )
  }
}
