#!/bin/sh
set -e

# ── This entrypoint runs as ROOT so it can fix file ownership / permissions
# ── before dropping to the unprivileged nextjs (uid 1001) user via su-exec.

DB_PATH="${DATABASE_URL:-file:/app/data/cfcenter.db}"
DB_FILE=$(echo "$DB_PATH" | sed 's|^file:||')
DB_DIR=$(dirname "$DB_FILE")

# Ensure data directory exists and is owned by nextjs
if [ ! -d "$DB_DIR" ]; then
  echo "[entrypoint] Creating data directory: $DB_DIR"
  mkdir -p "$DB_DIR"
fi
chown -R 1001:1001 "$DB_DIR" 2>/dev/null || true

# ── Docker socket: let nextjs user access it ──
# The host Docker socket GID varies; create/reuse a group with the same GID
# and add nextjs to it so the app can spawn helper containers for updates.
DOCKER_SOCK="/var/run/docker.sock"
if [ -S "$DOCKER_SOCK" ]; then
  DOCKER_GID=$(stat -c '%g' "$DOCKER_SOCK" 2>/dev/null || stat -f '%g' "$DOCKER_SOCK" 2>/dev/null || echo "")
  if [ -n "$DOCKER_GID" ] && [ "$DOCKER_GID" != "0" ]; then
    # Create a group with the socket's GID (ignore if it already exists)
    addgroup -g "$DOCKER_GID" dockersock 2>/dev/null || true
    addgroup nextjs dockersock 2>/dev/null || true
    echo "[entrypoint] Added nextjs to docker socket group (gid=$DOCKER_GID)"
  else
    # Socket owned by root — make it group-readable/writable for nextjs
    chmod 666 "$DOCKER_SOCK" 2>/dev/null || true
    echo "[entrypoint] Set docker socket to 666 (root-owned)"
  fi
fi

# ── /repo bind-mount: mark as safe directory for git (do NOT chown — it changes host ownership) ──
REPO="${CFCENTER_REPO_DIR:-/repo}"
if [ -d "$REPO/.git" ]; then
  git config --global --add safe.directory "$REPO" 2>/dev/null || true
  # Also set safe.directory for the nextjs user (git commands run via sudo)
  su-exec nextjs git config --global --add safe.directory "$REPO" 2>/dev/null || true
  echo "[entrypoint] Marked $REPO as safe git directory"
fi

# Initialize schema + run additive migrations (as nextjs user)
echo "[entrypoint] Initializing database..."
su-exec nextjs node db-migrate.js

echo "[entrypoint] Starting as nextjs..."
exec su-exec nextjs "$@"
