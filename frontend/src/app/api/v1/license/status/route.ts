import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// All features always unlocked — no community/enterprise distinction
const LICENSE_STATUS = {
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
  return NextResponse.json(LICENSE_STATUS)
}
