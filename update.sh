#!/bin/bash
# ============================================
# ProxCenter Update Script
# Run this on the remote server after pushing code changes.
# Usage: ./update.sh
# ============================================

set -e

CONTAINER_NAME="proxcenter-frontend"
IMAGE_NAME="proxcenter-frontend:dev"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== ProxCenter Update ==="
echo "Repo: $REPO_DIR"
echo ""

# 1. Pull latest code
echo "[1/4] Pulling latest code..."
cd "$REPO_DIR"
git pull origin main

# 2. Rebuild Docker image
echo "[2/4] Building Docker image..."
docker build -t "$IMAGE_NAME" ./frontend

# 3. Preserve secrets from running container
echo "[3/4] Preserving secrets..."
APP_SECRET=$(docker inspect "$CONTAINER_NAME" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep APP_SECRET | cut -d= -f2)
NEXTAUTH_SECRET=$(docker inspect "$CONTAINER_NAME" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep NEXTAUTH_SECRET | cut -d= -f2)
NEXTAUTH_URL=$(docker inspect "$CONTAINER_NAME" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep NEXTAUTH_URL | cut -d= -f2-)

if [ -z "$APP_SECRET" ] || [ -z "$NEXTAUTH_SECRET" ]; then
  echo "ERROR: Could not read secrets from running container."
  echo "Make sure '$CONTAINER_NAME' is running."
  exit 1
fi

echo "  APP_SECRET: ${APP_SECRET:0:8}..."
echo "  NEXTAUTH_URL: $NEXTAUTH_URL"

# 4. Recreate container
echo "[4/4] Recreating container..."
docker stop "$CONTAINER_NAME"
docker rm "$CONTAINER_NAME"

docker run -d --name "$CONTAINER_NAME" \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=file:/app/data/proxcenter.db \
  -e APP_SECRET="$APP_SECRET" \
  -e NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
  -e NEXTAUTH_URL="$NEXTAUTH_URL" \
  -v proxcenter_data:/app/data \
  --restart unless-stopped \
  "$IMAGE_NAME"

echo ""
echo "=== Update complete ==="
echo "Container: $(docker ps --filter name=$CONTAINER_NAME --format '{{.Status}}')"
echo "Access: $NEXTAUTH_URL"
