# CFCenter Deployment Guide

## Prerequisites

- A Linux server with Docker installed
- Git access to the cfcenter repository
- SSH access to the server

## Initial Setup (First Time)

### 1. Clone the repository on the server

```bash
git clone https://github.com/YOUR_USER/cfcenter.git /opt/CFCenter-src
```

### 2. Build the Docker image

```bash
cd /opt/CFCenter-src
docker build -t CFCenter-frontend:dev ./frontend
```

### 3. Create the data volume

```bash
docker volume create CFCenter_data
```

### 4. Start the container

```bash
docker run -d --name CFCenter-frontend \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=file:/app/data/CFCenter.db \
  -e APP_SECRET=$(openssl rand -hex 32) \
  -e NEXTAUTH_SECRET=$(openssl rand -hex 32) \
  -e NEXTAUTH_URL=http://YOUR_SERVER_IP:3000 \
  -v CFCenter_data:/app/data \
  --restart unless-stopped \
  CFCenter-frontend:dev
```

> **Important:** Replace `YOUR_SERVER_IP` with your actual server IP address.
>
> **Important:** Save the generated `APP_SECRET` value. If you recreate the container with a different `APP_SECRET`, previously stored Proxmox credentials will not decrypt. You can view the current value with:
> ```bash
> docker inspect CFCenter-frontend | grep APP_SECRET
> ```

### 5. Access CFCenter

Open `http://YOUR_SERVER_IP:3000` in your browser.

---

## Updating (After Code Changes)

### 1. Push changes from your development machine

```powershell
cd c:\Users\atorres\Documents\GitHub\cfcenter
git add -A
git commit -m "description of changes"
git push origin main
```

### 2. SSH into the server and pull changes

```bash
cd /opt/CFCenter-src
git pull origin main
```

### 3. Rebuild the Docker image

```bash
docker build -t CFCenter-frontend:dev ./frontend
```

### 4. Restart the container

```bash
# Get the current APP_SECRET and NEXTAUTH_SECRET before removing
APP_SECRET=$(docker inspect CFCenter-frontend --format '{{range .Config.Env}}{{println .}}{{end}}' | grep APP_SECRET | cut -d= -f2)
NEXTAUTH_SECRET=$(docker inspect CFCenter-frontend --format '{{range .Config.Env}}{{println .}}{{end}}' | grep NEXTAUTH_SECRET | cut -d= -f2)
SERVER_IP=$(hostname -I | awk '{print $1}')

# Stop and remove the old container
docker stop CFCenter-frontend
docker rm CFCenter-frontend

# Start with the new image (reusing the same secrets)
docker run -d --name CFCenter-frontend \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=file:/app/data/CFCenter.db \
  -e APP_SECRET=$APP_SECRET \
  -e NEXTAUTH_SECRET=$NEXTAUTH_SECRET \
  -e NEXTAUTH_URL=http://$SERVER_IP:3000 \
  -v CFCenter_data:/app/data \
  --restart unless-stopped \
  CFCenter-frontend:dev
```

> The `CFCenter_data` volume persists across container restarts, so your database (connections, settings, users) is preserved.

---

## Useful Commands

```bash
# View logs
docker logs -f CFCenter-frontend

# Check container status
docker ps -a | grep CFCenter

# Restart the container
docker restart CFCenter-frontend

# Stop the container
docker stop CFCenter-frontend

# View environment variables
docker inspect CFCenter-frontend --format '{{range .Config.Env}}{{println .}}{{end}}'

# Access container shell
docker exec -it CFCenter-frontend sh

# Clean up old images
docker image prune -f
```

---

## Ports

| Service  | Port | Description                |
|----------|------|----------------------------|
| Frontend | 3000 | HTTP + WebSocket (unified) |

---

## Environment Variables

| Variable         | Required | Description                                      |
|------------------|----------|--------------------------------------------------|
| `APP_SECRET`     | Yes      | Encrypts stored Proxmox credentials              |
| `NEXTAUTH_SECRET`| Yes      | Signs session tokens                             |
| `NEXTAUTH_URL`   | Yes      | Public URL of the app (e.g. http://IP:3000)      |
| `DATABASE_URL`   | Yes      | SQLite database path (file:/app/data/CFCenter.db) |
| `NODE_ENV`       | Yes      | Set to `production`                              |
| `ORCHESTRATOR_URL` | No     | Go backend URL (enterprise only)                 |

---

## Troubleshooting

**"APP_SECRET is missing in .env"**
The `APP_SECRET` environment variable was not passed to the container. See step 4 of Initial Setup.

**Container exits immediately**
Check logs: `docker logs CFCenter-frontend`

**Can't connect on port 3000**
Ensure the firewall allows port 3000: `ufw allow 3000/tcp` (Ubuntu) or `firewall-cmd --add-port=3000/tcp --permanent` (RHEL/CentOS).

**Database lost after update**
The `CFCenter_data` volume must be reused. Never pass `--rm` or `docker volume rm CFCenter_data` unless you intend to reset.
