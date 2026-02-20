# CFCenter Deployment Guide

## Quick Start (Fresh Server)

SSH into your server and run:

```bash
git clone https://github.com/pykestrel/cfcenter.git /opt/cfcenter
cd /opt/cfcenter
sudo ./install.sh install
```

The script automatically:
1. Detects your OS (Ubuntu, Debian, CentOS, RHEL, Rocky, AlmaLinux, Fedora)
2. Installs Docker, Git, and OpenSSL if missing
3. Builds the Docker image from source
4. Generates secure secrets
5. Starts the container and waits for it to be healthy

Once complete, open `http://YOUR_SERVER_IP:3000` in your browser.

> **Important:** The generated `APP_SECRET` encrypts stored Proxmox credentials. If you recreate the container with a different secret, previously stored credentials will not decrypt. Secrets are saved to `/opt/cfcenter/.env` for reference.

---

## Updating (After Code Changes)

### 1. Push changes from your development machine

```powershell
git add -A
git commit -m "description of changes"
git push origin main
```

### 2. SSH into the server and run update

```bash
cd /opt/cfcenter
sudo ./install.sh update
```

This pulls the latest code, rebuilds the image, preserves your secrets and data, and restarts the container.

---

## Other Commands

```bash
# Check deployment status
sudo ./install.sh status

# Uninstall (interactive, asks before removing data)
sudo ./install.sh uninstall
```

---

## Install Options

```
sudo ./install.sh install [options]

Options:
  --repo <url>       Git repo URL (default: https://github.com/pykestrel/cfcenter.git)
  --branch <name>    Git branch (default: main)
  --port <port>      Host port to expose (default: 3000)
  --dir <path>       Install directory (default: /opt/cfcenter)
```

---

## Useful Docker Commands

```bash
# View logs
docker logs -f cfcenter-frontend

# Check container status
docker ps -a | grep cfcenter

# Restart the container
docker restart cfcenter-frontend

# Stop / Start
docker stop cfcenter-frontend
docker start cfcenter-frontend

# View environment variables
docker inspect cfcenter-frontend --format '{{range .Config.Env}}{{println .}}{{end}}'

# Access container shell
docker exec -it cfcenter-frontend sh

# Clean up old images
docker image prune -f
```

---

## Architecture

| Component  | Port | Description                |
|------------|------|----------------------------|
| Frontend   | 3000 | Next.js + WebSocket proxy (unified) |

---

## Environment Variables

| Variable           | Required | Description                                        |
|--------------------|----------|----------------------------------------------------|
| `APP_SECRET`       | Yes      | Encrypts stored Proxmox credentials                |
| `NEXTAUTH_SECRET`  | Yes      | Signs session tokens                               |
| `NEXTAUTH_URL`     | Yes      | Public URL of the app (e.g. `http://IP:3000`)      |
| `DATABASE_URL`     | Yes      | SQLite database path (`file:/app/data/cfcenter.db`)|
| `NODE_ENV`         | Yes      | Set to `production`                                |
| `ORCHESTRATOR_URL` | No       | Go backend URL (enterprise only)                   |

---

## Troubleshooting

**"APP_SECRET is missing in .env"**
The `APP_SECRET` environment variable was not passed to the container. Re-run `sudo ./install.sh install` or check your `.env` file.

**Container exits immediately**
Check logs: `docker logs cfcenter-frontend`

**Can't connect on port 3000**
Ensure the firewall allows port 3000: `ufw allow 3000/tcp` (Ubuntu) or `firewall-cmd --add-port=3000/tcp --permanent` (RHEL/CentOS).

**Database lost after update**
The `cfcenter_data` volume persists across updates. Never run `docker volume rm cfcenter_data` unless you intend to reset.

**Migrating from ProxCenter**
The install script automatically detects legacy `proxcenter-frontend` containers and `proxcenter_data` volumes and migrates them.
