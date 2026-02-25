import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// All features always unlocked — no community/enterprise distinction
const LICENSE_FEATURES = {
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
  return NextResponse.json(LICENSE_FEATURES)
}
