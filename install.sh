#!/bin/bash
set -e

# ============================================
# CFCenter — Unified Install & Update Script
# ============================================
#
# Fresh install (on a clean server):
#   sudo ./install.sh install
#
# Update (rebuild & restart from latest code):
#   sudo ./install.sh update
#
# Uninstall (stop container, optionally remove data):
#   sudo ./install.sh uninstall
#
# ============================================

# ----------------------------------------
# Constants
# ----------------------------------------
CONTAINER_NAME="cfcenter-frontend"
IMAGE_NAME="cfcenter-frontend:dev"
DATA_VOLUME="cfcenter_data"
DB_FILE="cfcenter.db"
APP_PORT=3000
REPO_URL="https://github.com/pykestrel/cfcenter.git"
REPO_BRANCH="main"

# Legacy names (for migration from ProxCenter)
OLD_CONTAINER="proxcenter-frontend"
OLD_VOLUME="proxcenter_data"
OLD_DB="proxcenter.db"

# ----------------------------------------
# Colors
# ----------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ----------------------------------------
# Helpers
# ----------------------------------------
log_info()    { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_success() { echo -e "${GREEN}[ OK ]${NC}  $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error()   { echo -e "${RED}[ERR ]${NC}  $1"; exit 1; }

print_banner() {
    echo -e "${CYAN}"
    cat << 'BANNER'

   ██████╗███████╗ ██████╗███████╗███╗   ██╗████████╗███████╗██████╗
  ██╔════╝██╔════╝██╔════╝██╔════╝████╗  ██║╚══██╔══╝██╔════╝██╔══██╗
  ██║     █████╗  ██║     █████╗  ██╔██╗ ██║   ██║   █████╗  ██████╔╝
  ██║     ██╔══╝  ██║     ██╔══╝  ██║╚██╗██║   ██║   ██╔══╝  ██╔══██╗
  ╚██████╗██║     ╚██████╗███████╗██║ ╚████║   ██║   ███████╗██║  ██║
   ╚═════╝╚═╝      ╚═════╝╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝╚═╝  ╚═╝

BANNER
    echo -e "${NC}"
}

show_usage() {
    echo "Usage: sudo $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  install     Fresh install on a clean server"
    echo "  update      Rebuild image & restart from latest code"
    echo "  uninstall   Stop container and optionally remove data"
    echo "  status      Show current deployment status"
    echo ""
    echo "Options:"
    echo "  --repo <url>       Git repo URL (default: $REPO_URL)"
    echo "  --branch <name>    Git branch (default: $REPO_BRANCH)"
    echo "  --port <port>      Host port to expose (default: $APP_PORT)"
    echo "  --dir <path>       Install directory (default: /opt/cfcenter)"
    echo "  --help             Show this help"
    echo ""
    exit 0
}

# ----------------------------------------
# Parse arguments
# ----------------------------------------
COMMAND=""
INSTALL_DIR="/opt/cfcenter"

parse_args() {
    if [ $# -eq 0 ]; then
        show_usage
    fi

    COMMAND="$1"
    shift

    while [[ $# -gt 0 ]]; do
        case $1 in
            --repo)     REPO_URL="$2";    shift 2 ;;
            --branch)   REPO_BRANCH="$2"; shift 2 ;;
            --port)     APP_PORT="$2";    shift 2 ;;
            --dir)      INSTALL_DIR="$2"; shift 2 ;;
            --help|-h)  show_usage ;;
            *)          log_error "Unknown option: $1" ;;
        esac
    done
}

# ============================================
# OS Detection & Package Manager
# ============================================
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
    elif [ -f /etc/debian_version ]; then
        OS="debian"
        OS_VERSION=$(cat /etc/debian_version)
    elif [ -f /etc/redhat-release ]; then
        OS="rhel"
    else
        log_error "Unsupported operating system"
    fi

    log_info "Detected OS: ${BOLD}$OS $OS_VERSION${NC}"

    case $OS in
        ubuntu|debian)
            PKG_UPDATE="apt-get update -qq"
            PKG_INSTALL="apt-get install -y -qq"
            ;;
        centos|rhel|rocky|almalinux|fedora)
            PKG_UPDATE="dnf check-update || true"
            PKG_INSTALL="dnf install -y -q"
            ;;
        *)
            log_error "Unsupported OS: $OS. Supported: Ubuntu, Debian, CentOS, RHEL, Rocky, AlmaLinux, Fedora."
            ;;
    esac
}

# ============================================
# Dependency Installation
# ============================================
install_docker() {
    if command -v docker &> /dev/null; then
        log_success "Docker already installed ($(docker --version | awk '{print $3}' | tr -d ','))"
        return
    fi

    log_info "Installing Docker..."

    case $OS in
        ubuntu|debian)
            apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
            $PKG_INSTALL ca-certificates curl gnupg lsb-release
            install -m 0755 -d /etc/apt/keyrings
            curl -fsSL "https://download.docker.com/linux/$OS/gpg" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            chmod a+r /etc/apt/keyrings/docker.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS $(lsb_release -cs) stable" \
                | tee /etc/apt/sources.list.d/docker.list > /dev/null
            apt-get update -qq
            $PKG_INSTALL docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        centos|rhel|rocky|almalinux|fedora)
            dnf remove -y docker docker-client docker-client-latest docker-common \
                docker-latest docker-latest-logrotate docker-logrotate docker-engine 2>/dev/null || true
            $PKG_INSTALL dnf-plugins-core
            dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            $PKG_INSTALL docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
    esac

    systemctl start docker
    systemctl enable docker

    log_success "Docker installed"
}

install_git() {
    if command -v git &> /dev/null; then
        log_success "Git already installed"
        return
    fi

    log_info "Installing Git..."
    $PKG_INSTALL git
    log_success "Git installed"
}

ensure_openssl() {
    if command -v openssl &> /dev/null; then
        return
    fi
    log_info "Installing OpenSSL..."
    $PKG_INSTALL openssl
}

# ============================================
# Detect legacy ProxCenter deployment
# ============================================
migrate_legacy() {
    local migrated=false

    # Detect old container
    if docker inspect "$OLD_CONTAINER" > /dev/null 2>&1; then
        log_warn "Found legacy container '$OLD_CONTAINER' — stopping and removing..."
        docker stop "$OLD_CONTAINER" 2>/dev/null || true
        docker rm "$OLD_CONTAINER" 2>/dev/null || true
        migrated=true
    fi

    # Detect old volume — reuse it, just update the variable
    if docker volume inspect "$OLD_VOLUME" > /dev/null 2>&1; then
        if ! docker volume inspect "$DATA_VOLUME" > /dev/null 2>&1; then
            log_warn "Using legacy volume '$OLD_VOLUME' (data preserved)"
            DATA_VOLUME="$OLD_VOLUME"
        fi
    fi

    # Rename db file inside volume if needed
    if [ "$DATA_VOLUME" = "$OLD_VOLUME" ] || docker volume inspect "$DATA_VOLUME" > /dev/null 2>&1; then
        docker run --rm -v "$DATA_VOLUME":/data alpine sh -c \
            "[ -f /data/$OLD_DB ] && mv /data/$OLD_DB /data/$DB_FILE && echo '  [migrate] Renamed $OLD_DB -> $DB_FILE' || true" 2>/dev/null || true
    fi

    if [ "$migrated" = true ]; then
        log_success "Legacy migration complete"
    fi
}

# ============================================
# Get server IP
# ============================================
get_server_ip() {
    local ip
    ip=$(hostname -I 2>/dev/null | awk '{print $1}' | head -1)
    if [ -z "$ip" ]; then
        ip="localhost"
    fi
    echo "$ip"
}

# ============================================
# INSTALL command
# ============================================
do_install() {
    log_info "Starting fresh CFCenter installation..."
    echo ""

    # --- Prerequisites ---
    detect_os
    echo ""
    $PKG_UPDATE > /dev/null 2>&1 || true
    install_docker
    install_git
    ensure_openssl
    echo ""

    # --- Migrate legacy if present ---
    migrate_legacy
    echo ""

    # --- Clone or update repo ---
    if [ -d "$INSTALL_DIR/.git" ]; then
        log_info "Repository already exists at $INSTALL_DIR, pulling latest..."
        cd "$INSTALL_DIR"
        git pull origin "$REPO_BRANCH"
    else
        log_info "Cloning repository into $INSTALL_DIR..."
        git clone --branch "$REPO_BRANCH" "$REPO_URL" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi
    log_success "Source code ready"
    echo ""

    # --- Build Docker image ---
    log_info "Building Docker image (this may take a few minutes)..."
    docker build -t "$IMAGE_NAME" ./frontend
    log_success "Image built: $IMAGE_NAME"
    echo ""

    # --- Create data volume ---
    docker volume create "$DATA_VOLUME" 2>/dev/null || true

    # Initialize data directory permissions
    docker run --rm --user root \
        -v "$DATA_VOLUME":/app/data \
        "$IMAGE_NAME" \
        sh -c "mkdir -p /app/data && chown -R 1001:1001 /app/data" 2>/dev/null || true

    # --- Generate secrets ---
    log_info "Generating secrets..."
    local app_secret nextauth_secret server_ip
    app_secret=$(openssl rand -hex 32)
    nextauth_secret=$(openssl rand -hex 32)
    server_ip=$(get_server_ip)

    # --- Save .env for reference ---
    cat > "$INSTALL_DIR/.env" << EOF
# CFCenter Configuration
# Generated on $(date)
# This file is for reference — secrets are passed directly to the container.

APP_SECRET=$app_secret
NEXTAUTH_SECRET=$nextauth_secret
NEXTAUTH_URL=http://$server_ip:$APP_PORT
APP_PORT=$APP_PORT
EOF
    chmod 600 "$INSTALL_DIR/.env"
    log_success "Secrets generated and saved to $INSTALL_DIR/.env"
    echo ""

    # --- Start container ---
    log_info "Starting CFCenter..."

    # Remove existing container if present (from a previous failed install)
    docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

    docker run -d --name "$CONTAINER_NAME" \
        -p "$APP_PORT":3000 \
        -e NODE_ENV=production \
        -e DATABASE_URL="file:/app/data/$DB_FILE" \
        -e APP_SECRET="$app_secret" \
        -e NEXTAUTH_SECRET="$nextauth_secret" \
        -e NEXTAUTH_URL="http://$server_ip:$APP_PORT" \
        -e CFCENTER_REPO_DIR=/repo \
        -e CFCENTER_CONTAINER_NAME="$CONTAINER_NAME" \
        -e CFCENTER_IMAGE_NAME="$IMAGE_NAME" \
        -v "$DATA_VOLUME":/app/data \
        -v /var/run/docker.sock:/var/run/docker.sock:ro \
        -v "$INSTALL_DIR":/repo \
        --restart unless-stopped \
        "$IMAGE_NAME"

    echo ""

    # --- Wait for healthy ---
    wait_for_healthy

    # --- Print success ---
    echo ""
    echo -e "${GREEN}${BOLD}============================================${NC}"
    echo -e "${GREEN}${BOLD}   CFCenter is ready!${NC}"
    echo -e "${GREEN}${BOLD}============================================${NC}"
    echo ""
    echo -e "  URL:        ${CYAN}http://$server_ip:$APP_PORT${NC}"
    echo -e "  Install:    ${BOLD}$INSTALL_DIR${NC}"
    echo -e "  Container:  ${BOLD}$CONTAINER_NAME${NC}"
    echo -e "  Volume:     ${BOLD}$DATA_VOLUME${NC}"
    echo ""
    echo "Useful commands:"
    echo "  sudo $INSTALL_DIR/install.sh update      # Pull latest & rebuild"
    echo "  sudo $INSTALL_DIR/install.sh status       # Check status"
    echo "  docker logs -f $CONTAINER_NAME            # View logs"
    echo "  docker stop $CONTAINER_NAME               # Stop"
    echo "  docker start $CONTAINER_NAME              # Start"
    echo ""
}

# ============================================
# UPDATE command
# ============================================
do_update() {
    log_info "Updating CFCenter..."
    echo ""

    # --- Find repo directory ---
    REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
    if [ ! -d "$REPO_DIR/frontend" ]; then
        log_error "Cannot find frontend/ directory. Run this script from the CFCenter repo root."
    fi

    # --- Detect running container (new or legacy name) ---
    local running_container=""
    if docker inspect "$CONTAINER_NAME" > /dev/null 2>&1; then
        running_container="$CONTAINER_NAME"
    elif docker inspect "$OLD_CONTAINER" > /dev/null 2>&1; then
        running_container="$OLD_CONTAINER"
        log_warn "Found legacy container '$OLD_CONTAINER', will migrate to '$CONTAINER_NAME'"
    fi

    # --- Detect data volume ---
    if ! docker volume inspect "$DATA_VOLUME" > /dev/null 2>&1; then
        if docker volume inspect "$OLD_VOLUME" > /dev/null 2>&1; then
            DATA_VOLUME="$OLD_VOLUME"
            log_warn "Using legacy volume '$OLD_VOLUME'"
        fi
    fi

    # --- Preserve secrets from running container ---
    local app_secret="" nextauth_secret="" nextauth_url=""
    if [ -n "$running_container" ]; then
        log_info "Preserving secrets from '$running_container'..."
        local env_dump
        env_dump=$(docker inspect "$running_container" --format '{{range .Config.Env}}{{println .}}{{end}}')
        app_secret=$(echo "$env_dump" | grep "^APP_SECRET=" | cut -d= -f2)
        nextauth_secret=$(echo "$env_dump" | grep "^NEXTAUTH_SECRET=" | cut -d= -f2)
        nextauth_url=$(echo "$env_dump" | grep "^NEXTAUTH_URL=" | cut -d= -f2-)
    fi

    # Fall back to .env file if container wasn't running
    if [ -z "$app_secret" ] && [ -f "$REPO_DIR/.env" ]; then
        log_warn "No running container found, reading secrets from .env file..."
        app_secret=$(grep "^APP_SECRET=" "$REPO_DIR/.env" | cut -d= -f2)
        nextauth_secret=$(grep "^NEXTAUTH_SECRET=" "$REPO_DIR/.env" | cut -d= -f2)
        nextauth_url=$(grep "^NEXTAUTH_URL=" "$REPO_DIR/.env" | cut -d= -f2-)
    fi

    if [ -z "$app_secret" ] || [ -z "$nextauth_secret" ]; then
        log_error "Could not recover secrets. Ensure the container is running or .env file exists at $REPO_DIR/.env"
    fi

    if [ -z "$nextauth_url" ]; then
        nextauth_url="http://$(get_server_ip):$APP_PORT"
    fi

    echo "  APP_SECRET:   ${app_secret:0:8}..."
    echo "  NEXTAUTH_URL: $nextauth_url"
    echo ""

    # --- Pull latest code ---
    log_info "[1/4] Pulling latest code..."
    cd "$REPO_DIR"
    git pull origin "$REPO_BRANCH"
    echo ""

    # --- Build image ---
    log_info "[2/4] Building Docker image..."
    docker build -t "$IMAGE_NAME" ./frontend
    log_success "Image built"
    echo ""

    # --- Stop old container ---
    log_info "[3/4] Stopping old container..."
    if [ -n "$running_container" ]; then
        docker stop "$running_container" 2>/dev/null || true
        docker rm "$running_container" 2>/dev/null || true
    fi

    # --- Migrate db file if needed ---
    docker run --rm -v "$DATA_VOLUME":/data alpine sh -c \
        "[ -f /data/$OLD_DB ] && mv /data/$OLD_DB /data/$DB_FILE && echo '  [migrate] Renamed $OLD_DB -> $DB_FILE' || true" 2>/dev/null || true

    # --- Start new container ---
    log_info "[4/4] Starting new container..."
    docker run -d --name "$CONTAINER_NAME" \
        -p "$APP_PORT":3000 \
        -e NODE_ENV=production \
        -e DATABASE_URL="file:/app/data/$DB_FILE" \
        -e APP_SECRET="$app_secret" \
        -e NEXTAUTH_SECRET="$nextauth_secret" \
        -e NEXTAUTH_URL="$nextauth_url" \
        -e CFCENTER_REPO_DIR=/repo \
        -e CFCENTER_CONTAINER_NAME="$CONTAINER_NAME" \
        -e CFCENTER_IMAGE_NAME="$IMAGE_NAME" \
        -v "$DATA_VOLUME":/app/data \
        -v /var/run/docker.sock:/var/run/docker.sock:ro \
        -v "$REPO_DIR":/repo \
        --restart unless-stopped \
        "$IMAGE_NAME"

    echo ""
    wait_for_healthy

    echo ""
    echo -e "${GREEN}${BOLD}=== Update complete ===${NC}"
    echo -e "  Container: $(docker ps --filter name=$CONTAINER_NAME --format '{{.Status}}')"
    echo -e "  Access:    ${CYAN}$nextauth_url${NC}"
    echo ""
}

# ============================================
# UNINSTALL command
# ============================================
do_uninstall() {
    echo ""
    log_warn "This will stop and remove the CFCenter container."
    echo ""
    read -rp "Remove container? [y/N] " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        docker stop "$CONTAINER_NAME" 2>/dev/null || docker stop "$OLD_CONTAINER" 2>/dev/null || true
        docker rm "$CONTAINER_NAME" 2>/dev/null || docker rm "$OLD_CONTAINER" 2>/dev/null || true
        docker rmi "$IMAGE_NAME" 2>/dev/null || true
        log_success "Container removed"
    fi

    echo ""
    read -rp "Remove data volume (ALL DATA WILL BE LOST)? [y/N] " confirm_data
    if [[ "$confirm_data" =~ ^[Yy]$ ]]; then
        docker volume rm "$DATA_VOLUME" 2>/dev/null || true
        docker volume rm "$OLD_VOLUME" 2>/dev/null || true
        log_success "Data volume removed"
    else
        log_info "Data volume preserved"
    fi

    echo ""
    log_success "Uninstall complete"
    echo ""
}

# ============================================
# STATUS command
# ============================================
do_status() {
    echo ""
    echo -e "${BOLD}CFCenter Status${NC}"
    echo "-------------------------------------------"

    # Container
    local status
    if docker inspect "$CONTAINER_NAME" > /dev/null 2>&1; then
        status=$(docker ps --filter name="$CONTAINER_NAME" --format '{{.Status}}')
        if [ -n "$status" ]; then
            echo -e "  Container:  ${GREEN}Running${NC} ($status)"
        else
            echo -e "  Container:  ${YELLOW}Stopped${NC}"
        fi
    elif docker inspect "$OLD_CONTAINER" > /dev/null 2>&1; then
        echo -e "  Container:  ${YELLOW}Legacy ($OLD_CONTAINER)${NC} — run 'update' to migrate"
    else
        echo -e "  Container:  ${RED}Not found${NC}"
    fi

    # Image
    if docker image inspect "$IMAGE_NAME" > /dev/null 2>&1; then
        local img_created
        img_created=$(docker image inspect "$IMAGE_NAME" --format '{{.Created}}' | cut -d'T' -f1)
        echo -e "  Image:      ${GREEN}$IMAGE_NAME${NC} (built $img_created)"
    else
        echo -e "  Image:      ${RED}Not built${NC}"
    fi

    # Volume
    if docker volume inspect "$DATA_VOLUME" > /dev/null 2>&1; then
        echo -e "  Volume:     ${GREEN}$DATA_VOLUME${NC}"
    elif docker volume inspect "$OLD_VOLUME" > /dev/null 2>&1; then
        echo -e "  Volume:     ${YELLOW}$OLD_VOLUME (legacy)${NC}"
    else
        echo -e "  Volume:     ${RED}Not found${NC}"
    fi

    # URL
    local url
    if docker inspect "$CONTAINER_NAME" > /dev/null 2>&1; then
        url=$(docker inspect "$CONTAINER_NAME" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep "^NEXTAUTH_URL=" | cut -d= -f2-)
        if [ -n "$url" ]; then
            echo -e "  URL:        ${CYAN}$url${NC}"
        fi
    fi

    echo "-------------------------------------------"
    echo ""
}

# ============================================
# Wait for healthy
# ============================================
wait_for_healthy() {
    log_info "Waiting for CFCenter to be ready..."
    local attempt=1
    local max_attempts=45
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "http://localhost:$APP_PORT/api/health" > /dev/null 2>&1; then
            log_success "CFCenter is healthy"
            return
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    echo ""
    log_warn "Health check timed out after $((max_attempts * 2))s — container may still be starting."
    log_warn "Check logs: docker logs -f $CONTAINER_NAME"
}

# ============================================
# Main
# ============================================
main() {
    parse_args "$@"

    print_banner

    # Root check (not needed for status)
    if [ "$COMMAND" != "status" ] && [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root. Use: sudo $0 $COMMAND"
    fi

    case $COMMAND in
        install)    do_install ;;
        update)     do_update ;;
        uninstall)  do_uninstall ;;
        status)     do_status ;;
        *)          log_error "Unknown command: $COMMAND. Run '$0 --help' for usage." ;;
    esac
}

main "$@"
