#!/bin/bash
# ============================================
# CFCenter Update Script
# Run this on the remote server after pushing code changes.
# Usage: ./update.sh
# ============================================

set -e

NEW_CONTAINER="cfcenter-frontend"
OLD_CONTAINER="proxcenter-frontend"
IMAGE_NAME="cfcenter-frontend:dev"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

# Detect running container (old or new name)
if docker inspect "$NEW_CONTAINER" > /dev/null 2>&1; then
  RUNNING_CONTAINER="$NEW_CONTAINER"
elif docker inspect "$OLD_CONTAINER" > /dev/null 2>&1; then
  RUNNING_CONTAINER="$OLD_CONTAINER"
  echo "  [migrate] Found old container name '$OLD_CONTAINER', will rename to '$NEW_CONTAINER'"
else
  echo "ERROR: No running container found (checked '$NEW_CONTAINER' and '$OLD_CONTAINER')."
  exit 1
fi

# Detect data volume (old or new name)
DATA_VOLUME="cfcenter_data"
if ! docker volume inspect cfcenter_data > /dev/null 2>&1; then
  if docker volume inspect proxcenter_data > /dev/null 2>&1; then
    DATA_VOLUME="proxcenter_data"
    echo "  [migrate] Using existing volume 'proxcenter_data'"
  fi
fi

echo "=== CFCenter Update ==="
echo "Repo: $REPO_DIR"
echo "Container: $RUNNING_CONTAINER -> $NEW_CONTAINER"
echo "Volume: $DATA_VOLUME"
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
APP_SECRET=$(docker inspect "$RUNNING_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep APP_SECRET | cut -d= -f2)
NEXTAUTH_SECRET=$(docker inspect "$RUNNING_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep NEXTAUTH_SECRET | cut -d= -f2)
NEXTAUTH_URL=$(docker inspect "$RUNNING_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep NEXTAUTH_URL | cut -d= -f2-)

if [ -z "$APP_SECRET" ] || [ -z "$NEXTAUTH_SECRET" ]; then
  echo "ERROR: Could not read secrets from running container."
  echo "Make sure '$RUNNING_CONTAINER' is running."
  exit 1
fi

echo "  APP_SECRET: ${APP_SECRET:0:8}..."
echo "  NEXTAUTH_URL: $NEXTAUTH_URL"

# 4. Recreate container
echo "[4/4] Recreating container..."
docker stop "$RUNNING_CONTAINER"
docker rm "$RUNNING_CONTAINER"

docker run -d --name "$NEW_CONTAINER" \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=file:/app/data/cfcenter.db \
  -e APP_SECRET="$APP_SECRET" \
  -e NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
  -e NEXTAUTH_URL="$NEXTAUTH_URL" \
  -v "$DATA_VOLUME":/app/data \
  --restart unless-stopped \
  "$IMAGE_NAME"

echo ""
echo "=== Update complete ==="
echo "Container: $(docker ps --filter name=$NEW_CONTAINER --format '{{.Status}}')"
echo "Access: $NEXTAUTH_URL"
