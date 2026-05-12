# Deployment Guide

This guide covers deploying Bob - Multi-Repo PR Health Monitor to various environments.

## Table of Contents
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Docker Deployment](#docker-deployment)
- [GitHub Actions Setup](#github-actions-setup)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

---

## Local Development

### Prerequisites
- Python 3.8 or higher
- pip package manager
- GitHub Personal Access Token

### Setup Steps

1. **Clone the repository**
```bash
git clone https://github.com/your-org/bob.git
cd bob
```

2. **Install dependencies**
```bash
cd backend
pip install -r requirements.txt
```

3. **Configure environment**
```bash
cp .env.example .env
```

Edit `.env`:
```bash
GITHUB_TOKEN=ghp_your_token_here
TARGET_REPOS=org/repo1,org/repo2,org/repo3
PORT=5000
SCAN_INTERVAL=300
```

4. **Start the server**
```bash
python api_server.py
```

5. **Access dashboard**
Open browser: `http://localhost:5000`

---

## Production Deployment

### Option 1: Linux Server (Ubuntu/Debian)

1. **Install Python and dependencies**
```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv
```

2. **Create application directory**
```bash
sudo mkdir -p /opt/bob
sudo chown $USER:$USER /opt/bob
cd /opt/bob
```

3. **Clone and setup**
```bash
git clone https://github.com/your-org/bob.git .
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

4. **Configure environment**
```bash
cp .env.example .env
nano .env  # Edit with your credentials
```

5. **Create systemd service**
```bash
sudo nano /etc/systemd/system/bob.service
```

Add:
```ini
[Unit]
Description=Bob PR Health Monitor
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/bob/backend
Environment="PATH=/opt/bob/backend/venv/bin"
ExecStart=/opt/bob/backend/venv/bin/python api_server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

6. **Start service**
```bash
sudo systemctl daemon-reload
sudo systemctl enable bob
sudo systemctl start bob
sudo systemctl status bob
```

7. **Setup Nginx reverse proxy**
```bash
sudo apt install nginx
sudo nano /etc/nginx/sites-available/bob
```

Add:
```nginx
server {
    listen 80;
    server_name bob.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io {
        proxy_pass http://localhost:5000/socket.io;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

8. **Enable site**
```bash
sudo ln -s /etc/nginx/sites-available/bob /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

9. **Setup SSL with Let's Encrypt**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d bob.yourdomain.com
```

### Option 2: Heroku

1. **Create Procfile**
```bash
echo "web: cd backend && python api_server.py" > Procfile
```

2. **Create runtime.txt**
```bash
echo "python-3.11.0" > runtime.txt
```

3. **Deploy**
```bash
heroku create bob-pr-monitor
heroku config:set GITHUB_TOKEN=your_token
heroku config:set TARGET_REPOS=org/repo1,org/repo2
git push heroku main
```

---

## Docker Deployment

### Create Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY frontend/ ./frontend/

WORKDIR /app/backend

EXPOSE 5000

CMD ["python", "api_server.py"]
```

### Create docker-compose.yml

```yaml
version: '3.8'

services:
  bob:
    build: .
    ports:
      - "5000:5000"
    environment:
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - TARGET_REPOS=${TARGET_REPOS}
      - PORT=5000
      - SCAN_INTERVAL=300
    restart: unless-stopped
    volumes:
      - ./backend/.env:/app/backend/.env
```

### Deploy with Docker

```bash
# Build image
docker build -t bob-pr-monitor .

# Run container
docker run -d \
  --name bob \
  -p 5000:5000 \
  -e GITHUB_TOKEN=your_token \
  -e TARGET_REPOS=org/repo1,org/repo2 \
  bob-pr-monitor

# Or use docker-compose
docker-compose up -d
```

---

## GitHub Actions Setup

### Deploy Automated Scanning

1. **Copy workflow file**
```bash
cp backend/scanner.yml .github/workflows/pr-health-scanner.yml
```

2. **Add repository secrets**
Go to: `Settings > Secrets and variables > Actions`

Add:
- `ORG_PAT` - Organization-level GitHub PAT
- `OPENAI_KEY` - (Optional) For AI code review

3. **Configure workflow**
Edit `.github/workflows/pr-health-scanner.yml`:
```yaml
strategy:
  matrix:
    repo: 
      - your-org/repo-1
      - your-org/repo-2
      - your-org/repo-3
```

4. **Enable workflow**
- Go to Actions tab
- Enable workflows
- Workflow runs every 15 minutes automatically

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | `ghp_xxxxxxxxxxxxx` |
| `TARGET_REPOS` | Comma-separated list of repos | `org/repo1,org/repo2` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `SCAN_INTERVAL` | Background scan interval (seconds) | `300` |

### GitHub PAT Scopes Required

- ✅ `repo` - Full control of private repositories
- ✅ `issues:write` - Create and update issues
- ✅ `pull_requests:write` - Create and update pull requests

Generate at: https://github.com/settings/tokens

---

## Troubleshooting

### Server won't start

**Check Python version:**
```bash
python --version  # Should be 3.8+
```

**Check dependencies:**
```bash
pip install -r requirements.txt
```

**Check port availability:**
```bash
lsof -i :5000  # Linux/Mac
netstat -ano | findstr :5000  # Windows
```

### WebSocket connection fails

**Check CORS settings:**
Ensure `flask-cors` is installed and configured

**Check firewall:**
```bash
sudo ufw allow 5000
```

**Check reverse proxy:**
Ensure WebSocket upgrade headers are set in Nginx/Apache

### GitHub API rate limiting

**Use organization-level PAT:**
- Higher rate limits (5000 requests/hour)
- Better for multi-repo scanning

**Check rate limit:**
```bash
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/rate_limit
```

### Background scanning not working

**Check logs:**
```bash
# Systemd
sudo journalctl -u bob -f

# Docker
docker logs -f bob
```

**Verify environment variables:**
```bash
echo $GITHUB_TOKEN
echo $TARGET_REPOS
```

### Mobile view issues

**Clear browser cache:**
- Chrome: Ctrl+Shift+Delete
- Safari: Cmd+Option+E

**Check viewport meta tag:**
Ensure `index.html` has:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

---

## Monitoring

### Health Check Endpoint

```bash
curl http://localhost:5000/api/health
```

Response:
```json
{
  "status": "ok",
  "service": "Bob PR Health Scanner"
}
```

### Logs

**View real-time logs:**
```bash
# Systemd
sudo journalctl -u bob -f

# Docker
docker logs -f bob

# Direct
tail -f /var/log/bob/app.log
```

---

## Backup and Recovery

### Backup PR Status Data

Currently, PR status is stored in-memory. For production:

1. **Add database persistence** (planned feature)
2. **Export data periodically**
3. **Use external storage** (Redis, PostgreSQL)

### Recovery

If server crashes:
1. Restart service: `sudo systemctl restart bob`
2. Data will be repopulated on next scan
3. Check logs for errors

---

## Security Best Practices

1. **Never commit `.env` files**
2. **Use environment variables for secrets**
3. **Rotate GitHub tokens regularly**
4. **Use HTTPS in production**
5. **Keep dependencies updated**
6. **Monitor access logs**
7. **Use firewall rules**
8. **Implement rate limiting**

---

## Performance Optimization

### For Large Organizations

1. **Increase scan interval:**
```bash
SCAN_INTERVAL=600  # 10 minutes
```

2. **Use Redis for caching:**
```bash
pip install redis
```

3. **Implement database persistence:**
```bash
pip install sqlalchemy
```

4. **Use load balancer for multiple instances**

---

## Support

For issues or questions:
- Open an issue: https://github.com/your-org/bob/issues
- Check documentation: https://github.com/your-org/bob/wiki
- Contact: support@yourdomain.com
