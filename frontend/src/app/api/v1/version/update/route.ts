import { NextResponse } from 'next/server'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

import { VERSION, GITHUB_REPO } from '@/config/version'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 600 // 10 minutes max for build

const execAsync = promisify(exec)

// Paths — when running in Docker, the repo is mounted at /repo
// and the Docker socket is at /var/run/docker.sock
const REPO_DIR = process.env.CFCENTER_REPO_DIR || '/repo'
const DOCKER_SOCKET = '/var/run/docker.sock'
const CONTAINER_NAME = process.env.CFCENTER_CONTAINER_NAME || 'cfcenter-frontend'
const IMAGE_NAME = process.env.CFCENTER_IMAGE_NAME || 'cfcenter-frontend:dev'

// Simple in-memory update state
interface UpdateState {
  status: 'idle' | 'checking' | 'pulling' | 'building' | 'restarting' | 'completed' | 'error'
  progress: number
  message: string
  logs: string[]
  startedAt: string | null
  completedAt: string | null
  error: string | null
  newVersion: string | null
  branch: string | null
}

let updateState: UpdateState = {
  status: 'idle',
  progress: 0,
  message: '',
  logs: [],
  startedAt: null,
  completedAt: null,
  error: null,
  newVersion: null,
  branch: null
}

function resetState() {
  updateState = {
    status: 'idle',
    progress: 0,
    message: '',
    logs: [],
    startedAt: null,
    completedAt: null,
    error: null,
    newVersion: null,
    branch: null
  }
}

function addLog(msg: string) {
  const timestamp = new Date().toISOString().substring(11, 19)
  updateState.logs.push(`[${timestamp}] ${msg}`)
  updateState.message = msg
}

function checkPrerequisites(): { ok: boolean; error?: string } {
  // Check if Docker socket is available
  if (!fs.existsSync(DOCKER_SOCKET)) {
    return {
      ok: false,
      error: 'Docker socket not available. Mount /var/run/docker.sock into the container to enable GUI updates.'
    }
  }

  // Check if repo directory is mounted
  if (!fs.existsSync(REPO_DIR) || !fs.existsSync(path.join(REPO_DIR, '.git'))) {
    return {
      ok: false,
      error: `Repository not mounted at ${REPO_DIR}. Mount the CFCenter repo directory to enable GUI updates.`
    }
  }

  return { ok: true }
}

// Resolve the HOST path for the /repo bind mount by inspecting our own container.
// Inside the container REPO_DIR is /repo, but Docker needs the real host path
// when we spawn helper containers (docker run -v <hostPath>:/repo ...).
let _hostRepoPath: string | null = null
async function getHostRepoPath(): Promise<string> {
  if (_hostRepoPath) return _hostRepoPath
  try {
    const { stdout } = await execAsync(
      `docker inspect ${CONTAINER_NAME} --format '{{range .Mounts}}{{if eq .Destination "/repo"}}{{.Source}}{{end}}{{end}}'`,
      { timeout: 10000 }
    )
    const hostPath = stdout.trim()
    if (hostPath) {
      _hostRepoPath = hostPath
      return hostPath
    }
  } catch { /* fallback */ }
  // Fallback: assume REPO_DIR is already a host path (non-Docker or development)
  _hostRepoPath = REPO_DIR
  return REPO_DIR
}

async function runCommand(cmd: string, cwd?: string): Promise<string> {
  const { stdout, stderr } = await execAsync(cmd, {
    cwd: cwd || REPO_DIR,
    timeout: 300000, // 5 min timeout per command
    maxBuffer: 10 * 1024 * 1024 // 10MB buffer
  })
  return (stdout + stderr).trim()
}

function spawnWithLogs(cmd: string, args: string[], cwd?: string): Promise<{ code: number; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: cwd || REPO_DIR,
      shell: true,
      env: { ...process.env, DOCKER_BUILDKIT: '1' }
    })

    let output = ''

    child.stdout?.on('data', (data: Buffer) => {
      const line = data.toString().trim()
      if (line) {
        output += line + '\n'
        // Only log meaningful lines (skip empty/progress bars)
        const meaningful = line.split('\n').filter((l: string) =>
          l.trim() && !l.match(/^\s*$/) && !l.match(/^#\d+\s+\d+\.\d+/)
        )
        meaningful.forEach((l: string) => addLog(l.substring(0, 200)))
      }
    })

    child.stderr?.on('data', (data: Buffer) => {
      const line = data.toString().trim()
      if (line) {
        output += line + '\n'
        const meaningful = line.split('\n').filter((l: string) =>
          l.trim() && !l.match(/^\s*$/)
        )
        meaningful.forEach((l: string) => addLog(l.substring(0, 200)))
      }
    })

    child.on('close', (code) => {
      resolve({ code: code || 0, output })
    })

    child.on('error', (err) => {
      reject(err)
    })
  })
}

async function performUpdate() {
  try {
    updateState.status = 'checking'
    updateState.progress = 5
    updateState.startedAt = new Date().toISOString()
    addLog('Checking prerequisites...')

    const prereqs = checkPrerequisites()
    if (!prereqs.ok) {
      throw new Error(prereqs.error)
    }
    addLog('Prerequisites OK — Docker socket and repo available')

    // Step 1: Git fetch + hard reset via helper container (runs as root to avoid permission issues)
    updateState.status = 'pulling'
    updateState.progress = 10
    const branch = updateState.branch || 'main'
    addLog(`Fetching latest code from origin/${branch}...`)

    // Run git operations inside a temporary Alpine container with git, mounted as root
    // This avoids the "dubious ownership" and "Permission denied" errors when the
    // /repo bind mount is owned by a different user than the nextjs container process.
    const gitScript = [
      'set -e',
      `git config --global --add safe.directory /repo`,
      `cd /repo`,
      `git fetch origin ${branch}`,
      `git reset --hard origin/${branch}`,
      `git clean -fd || true`,
      `chmod +x /repo/install.sh 2>/dev/null || true`,
    ].join(' && ')

    const hostRepo = await getHostRepoPath()
    addLog(`Host repo path: ${hostRepo}`)

    const gitResult = await spawnWithLogs('docker', [
      'run', '--rm',
      '-v', `${hostRepo}:/repo`,
      'alpine/git:latest',
      'sh', '-c', gitScript
    ])
    if (gitResult.code !== 0) {
      throw new Error(`Git update failed (exit code ${gitResult.code})`)
    }

    addLog('Code updated successfully')

    // Read new version from package.json
    try {
      const pkgPath = path.join(REPO_DIR, 'frontend', 'src', 'config', 'version.ts')
      const versionFile = fs.readFileSync(pkgPath, 'utf8')
      const match = versionFile.match(/VERSION\s*=\s*'([^']+)'/)
      if (match) {
        updateState.newVersion = match[1]
        addLog(`New version: ${match[1]}`)
      }
    } catch {
      addLog('Could not read new version — continuing')
    }

    // Step 2: Docker build
    updateState.status = 'building'
    updateState.progress = 25
    addLog('Building new Docker image (this may take several minutes)...')

    const buildResult = await spawnWithLogs(
      'docker',
      ['build', '-t', IMAGE_NAME, './frontend'],
      REPO_DIR
    )
    if (buildResult.code !== 0) {
      throw new Error(`Docker build failed (exit code ${buildResult.code})`)
    }
    updateState.progress = 80
    addLog('Docker image built successfully')

    // Step 3: Restart container
    updateState.status = 'restarting'
    updateState.progress = 85
    addLog('Preparing to restart container...')

    // Get current container's environment and mounts to preserve them
    let envArgs = ''
    let volumeArgs = ''
    let portArgs = ''
    try {
      const inspectOutput = await runCommand(`docker inspect ${CONTAINER_NAME}`)
      const inspect = JSON.parse(inspectOutput)
      const container = inspect[0]

      // Preserve environment variables
      const envVars = container.Config?.Env || []
      envArgs = envVars
        .filter((e: string) => !e.startsWith('PATH=') && !e.startsWith('NODE_VERSION=') && !e.startsWith('YARN_VERSION='))
        .map((e: string) => `-e "${e.replace(/"/g, '\\"')}"`)
        .join(' ')

      // Preserve volume mounts
      const mounts = container.Mounts || []
      volumeArgs = mounts
        .map((m: { Type: string; Source: string; Destination: string }) => {
          if (m.Type === 'volume') return `-v ${m.Source}:${m.Destination}`
          if (m.Type === 'bind') return `-v ${m.Source}:${m.Destination}`
          return ''
        })
        .filter(Boolean)
        .join(' ')

      // Preserve port mappings
      const ports = container.HostConfig?.PortBindings || {}
      for (const [containerPort, bindings] of Object.entries(ports)) {
        const port = containerPort.replace('/tcp', '')
        for (const binding of (bindings as Array<{ HostPort: string }>)) {
          portArgs += ` -p ${binding.HostPort}:${port}`
        }
      }
    } catch (err) {
      addLog('Warning: Could not inspect current container, using defaults')
      envArgs = '-e NODE_ENV=production'
      volumeArgs = '-v cfcenter_data:/app/data'
      portArgs = '-p 3000:3000'
    }

    // Stop current container
    updateState.progress = 90
    addLog('Stopping current container...')
    await runCommand(`docker stop ${CONTAINER_NAME}`).catch(() => {})
    await runCommand(`docker rm ${CONTAINER_NAME}`).catch(() => {})

    // Start new container
    updateState.progress = 95
    addLog('Starting new container...')
    const runCmd = `docker run -d --name ${CONTAINER_NAME} ${portArgs} ${envArgs} ${volumeArgs} --restart unless-stopped ${IMAGE_NAME}`
    const runResult = await spawnWithLogs('sh', ['-c', runCmd])
    if (runResult.code !== 0) {
      throw new Error(`Failed to start new container (exit code ${runResult.code})`)
    }

    updateState.status = 'completed'
    updateState.progress = 100
    updateState.completedAt = new Date().toISOString()
    addLog('Update completed successfully! The application will restart momentarily.')

  } catch (error: unknown) {
    updateState.status = 'error'
    updateState.error = error instanceof Error ? error.message : 'Unknown error'
    addLog(`ERROR: ${updateState.error}`)
  }
}

// POST — Start the update process
export async function POST(request: Request) {
  // Check if already updating
  if (updateState.status !== 'idle' && updateState.status !== 'completed' && updateState.status !== 'error') {
    return NextResponse.json(
      { error: 'Update already in progress', state: updateState },
      { status: 409 }
    )
  }

  // Check prerequisites first
  const prereqs = checkPrerequisites()
  if (!prereqs.ok) {
    return NextResponse.json(
      { error: prereqs.error, updateSupported: false },
      { status: 400 }
    )
  }

  // Parse branch from request body
  let branch = 'main'
  try {
    const body = await request.json()
    if (body.branch && typeof body.branch === 'string') {
      branch = body.branch.trim()
    }
  } catch { /* no body or invalid JSON — use default */ }

  // Reset and start
  resetState()
  updateState.branch = branch

  // Start update in background (don't await)
  performUpdate()

  return NextResponse.json({
    message: 'Update started',
    branch,
    state: updateState
  })
}

// GET — Get current update state + check if updates are supported
export async function GET() {
  const prereqs = checkPrerequisites()

  // Run git read-only queries via helper container (avoids permission issues with bind mount)
  let currentBranch = 'main'
  let availableBranches: string[] = ['main']
  let lastCommit: { hash: string; message: string; date: string } | null = null
  try {
    if (prereqs.ok) {
      const gitInfoScript = [
        'git config --global --add safe.directory /repo',
        'cd /repo',
        'echo "BRANCH:$(git rev-parse --abbrev-ref HEAD)"',
        'echo "REMOTES:$(git branch -r --no-color | tr "\\n" ",")"',
        'echo "COMMIT:$(git log -1 --format="%h|||%s|||%ci")"',
      ].join(' && ')

      const hostRepo = await getHostRepoPath()
      const { stdout } = await execAsync(
        `docker run --rm -v ${hostRepo}:/repo alpine/git:latest sh -c '${gitInfoScript}'`,
        { timeout: 15000 }
      )

      for (const line of stdout.split('\n')) {
        if (line.startsWith('BRANCH:')) {
          currentBranch = line.replace('BRANCH:', '').trim() || 'main'
        } else if (line.startsWith('REMOTES:')) {
          const raw = line.replace('REMOTES:', '')
          availableBranches = raw
            .split(',')
            .map(b => b.trim().replace('origin/', ''))
            .filter(b => b && !b.includes('HEAD') && !b.includes('->'))
          if (!availableBranches.includes('main')) availableBranches.unshift('main')
        } else if (line.startsWith('COMMIT:')) {
          const parts = line.replace('COMMIT:', '').trim().split('|||')
          if (parts.length === 3) {
            lastCommit = { hash: parts[0], message: parts[1], date: parts[2] }
          }
        }
      }
    }
  } catch { /* git helper container not available */ }

  return NextResponse.json({
    state: updateState,
    updateSupported: prereqs.ok,
    unsupportedReason: prereqs.error || null,
    currentVersion: VERSION,
    containerName: CONTAINER_NAME,
    repoDir: REPO_DIR,
    currentBranch,
    availableBranches,
    lastCommit
  })
}

// DELETE — Reset update state (dismiss error/completion)
export async function DELETE() {
  resetState()
  return NextResponse.json({ message: 'Update state reset' })
}
