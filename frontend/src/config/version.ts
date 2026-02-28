// Configuration de version CFCenter
export const VERSION = '1.3.0'
export const VERSION_NAME = 'CFCenter'
export const GITHUB_REPO = 'adminsyspro/cfcenter'
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`

// Recent version changelog
export const CHANGELOG: Record<string, { date: string; changes: string[] }> = {
  '1.3.0': {
    date: '2026-02-28',
    changes: [
      'Terraform Integration — deploy VMs and manage PVE settings via Terraform workspaces',
      'Runbook Step Executor — wired to real Proxmox APIs (clone, config, power, snapshot, webhook)',
      'Deploy from Template — provision VMs directly from the Templates marketplace',
      'Standalone CVE Scanner — scan Proxmox nodes for vulnerabilities without orchestrator',
      'Software Update via GUI — update from Settings with branch selector and live logs',
      'Improved install.sh update flow — handles overwritten files automatically',
    ]
  },
  '1.2.0': {
    date: '2026-02-12',
    changes: [
      'DRS page redesign — KPIs with Recharts graphs, health score, activity panel',
      'Full Site Recovery — replication, failover, failback, recovery plans',
      'Emergency DR — start/stop DR VMs, real failover with network isolation',
      'Resource Planner — capacity planning with 10+ features',
      'Integrated CVE Scanner with backend connection',
      'Rolling updates per node with pre-checks',
      'HA maintenance mode — Proxmox ha_state detection in metrics',
      'Affinity rules by Proxmox tags',
      'Optimized inventory — SWR cache, 2s polling, modular components',
      'Bulk actions — grouped start/stop/migration from context menu',
      'Improved VM/CT console — nginx proxy and direct WebSocket support',
      'Dashboard widgets — Resource Trends, VM Status Waffle',
      'Performance — 30s TTL server cache, 40+ file optimizations',
    ]
  },
  '1.1.0': {
    date: '2026-02-07',
    changes: [
      'DRS (Distributed Resource Scheduler) with live migrations',
      'Affinity and anti-affinity rules',
      'Notification and alert system',
      'Proxmox firewall management',
      'Community/Enterprise license system',
      'Enterprise feature separation with page guards',
    ]
  },
  '1.0.0': {
    date: '2026-02-06',
    changes: [
      'Initial release of CFCenter Community',
      'Unlimited multi-cluster Proxmox VE management',
      'Real-time metrics dashboard',
      'VM/CT console with noVNC and xterm.js',
      'Proxmox Backup Server (PBS) support',
      'Integrated Ceph monitoring',
      'Simplified Docker deployment',
      'Multi-language support (EN/FR)',
    ]
  }
}
