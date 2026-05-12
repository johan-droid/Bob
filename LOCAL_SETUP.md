# Local Development Setup Guide

This guide will help you set up Bob for local development.

## Prerequisites

- Python 3.8 or higher
- pip package manager
- Git
- GitHub account
- Text editor (VS Code, Sublime, etc.)

## Quick Setup

### Step 1: Clone Repository

```bash
git clone https://github.com/johan-droid/Bob.git
cd Bob
```

### Step 2: Create Local Environment File

```bash
# Copy the example file
cp .env.example .env
```

### Step 3: Configure Environment Variables

Edit `.env` with your credentials:

```bash
# Required: GitHub Personal Access Token
GITHUB_TOKEN=ghp_your_actual_token_here

# Required: Repositories to monitor
TARGET_REPOS=your-org/repo1,your-org/repo2

# Required: GitHub OAuth App credentials
GITHUB_CLIENT_ID=your_actual_client_id
GITHUB_CLIENT_SECRET=your_actual_client_secret

# Required: Flask secret key
SECRET_KEY=generate_with_python_command_below
```

#### Generate Secret Key

```bash
python -c "import os; print(os.urandom(24).hex())"
```

Copy the output and paste it as your `SECRET_KEY`.

### Step 4: Create GitHub OAuth App (for local testing)

1. Go to: https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: Bob Local Dev
   - **Homepage URL**: `http://localhost:5000`
   - **Authorization callback URL**: `http://localhost:5000/callback/github`
4. Click "Register application"
5. Copy **Client ID** and **Client Secret** to your `.env` file

### Step 5: Run Setup Script

**Linux/Mac:**
```bash
chmod +x setup-local.sh
./setup-local.sh
```

**Windows:**
```bash
setup-local.bat
```

**Manual Setup:**
```bash
# Copy .env to backend
cp .env backend/.env

# Install dependencies
cd backend
pip install -r requirements.txt
```

### Step 6: Start the Server

```bash
cd backend
python api_server.py
```

You should see:
```
Bob Server Starting...
Monitoring X repositories
WebSocket enabled for real-time updates
 * Running on http://0.0.0.0:5000
```

### Step 7: Access the Application

Open your browser and navigate to:
```
http://localhost:5000
```

You should see the landing page. Click "Sign in with GitHub" to authenticate.

## Project Structure

```
Bob/
├── .env                        # Master environment file (LOCAL ONLY - NOT COMMITTED)
├── .env.example               # Environment template (committed)
├── backend/
│   ├── .env                   # Backend env (copied from root .env)
│   ├── api_server.py          # Flask server
│   ├── pr_health_scanner.py   # Scanner logic
│   └── requirements.txt       # Python dependencies
├── frontend/
│   ├── landing.html           # Landing page
│   ├── index.html             # Dashboard
│   ├── landing.css            # Landing styles
│   ├── styles.css             # Dashboard styles
│   └── app.js                 # WebSocket client
└── setup-local.sh/bat         # Setup scripts
```

## Environment File Hierarchy

```
Root .env (Master)
    ↓ (copied by setup script)
backend/.env (Used by Flask)
```

**Important:**
- `.env` files are in `.gitignore` and will NOT be committed
- Only `.env.example` files are committed to Git
- For Heroku, set environment variables via CLI (not .env files)

## Development Workflow

### 1. Make Changes

Edit files in `backend/` or `frontend/` directories.

### 2. Test Locally

```bash
cd backend
python api_server.py
```

Open `http://localhost:5000` to test.

### 3. Check Logs

Server logs appear in the terminal where you ran `api_server.py`.

### 4. Restart Server

Press `Ctrl+C` to stop, then run `python api_server.py` again.

## Common Tasks

### Update Environment Variables

1. Edit root `.env` file
2. Copy to backend:
   ```bash
   cp .env backend/.env
   ```
3. Restart server

### Add New Repository

1. Edit `.env`:
   ```bash
   TARGET_REPOS=org/repo1,org/repo2,org/new-repo
   ```
2. Copy to backend:
   ```bash
   cp .env backend/.env
   ```
3. Restart server

### Update Dependencies

```bash
cd backend
pip install -r requirements.txt --upgrade
```

### Clear Session Data

Stop the server and restart. In-memory data will be cleared.

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 5000
lsof -i :5000  # Mac/Linux
netstat -ano | findstr :5000  # Windows

# Kill the process or change PORT in .env
PORT=5001
```

### GitHub OAuth Not Working

1. Verify OAuth app callback URL is `http://localhost:5000/callback/github`
2. Check `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env`
3. Ensure you're accessing via `http://localhost:5000` (not `127.0.0.1`)

### WebSocket Connection Failed

1. Check Flask-SocketIO is installed:
   ```bash
   pip install flask-socketio python-socketio
   ```
2. Check browser console (F12) for errors
3. Ensure no firewall blocking port 5000

### No PRs Showing

1. Verify `GITHUB_TOKEN` has correct scopes
2. Check `TARGET_REPOS` format: `owner/repo,owner/repo`
3. Ensure repositories exist and are accessible
4. Wait for initial scan (5 minutes) or trigger manual scan

### Import Errors

```bash
# Reinstall dependencies
cd backend
pip install -r requirements.txt --force-reinstall
```

## Testing

### Test GitHub API Connection

```bash
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user
```

Should return your GitHub user info.

### Test Health Endpoint

```bash
curl http://localhost:5000/api/health
```

Should return:
```json
{"status": "ok", "service": "Bob PR Health Scanner"}
```

### Test WebSocket Connection

Open browser console (F12) and check for:
```
Connected to Bob server
```

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `GITHUB_TOKEN` | ✅ | GitHub PAT | `ghp_xxxxx` |
| `TARGET_REPOS` | ✅ | Repos to monitor | `org/repo1,org/repo2` |
| `GITHUB_CLIENT_ID` | ✅ | OAuth Client ID | `Iv1.xxxxx` |
| `GITHUB_CLIENT_SECRET` | ✅ | OAuth Secret | `xxxxx` |
| `SECRET_KEY` | ✅ | Flask session key | `hex_string` |
| `PORT` | ❌ | Server port | `5000` |
| `SCAN_INTERVAL` | ❌ | Scan interval (seconds) | `300` |

## Best Practices

### Security

1. **Never commit `.env` files** - They contain secrets
2. **Rotate tokens regularly** - Update `GITHUB_TOKEN` monthly
3. **Use separate OAuth apps** - One for local, one for production
4. **Keep dependencies updated** - Run `pip list --outdated`

### Development

1. **Use virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   venv\Scripts\activate     # Windows
   ```

2. **Test before committing**:
   - Test login flow
   - Test PR scanning
   - Test WebSocket updates
   - Test on mobile view

3. **Check logs for errors**:
   - Monitor terminal output
   - Check browser console (F12)

## Deploying to Heroku

Once local development is working:

1. **Don't copy `.env` to Heroku** - Use config vars instead
2. **Set Heroku config**:
   ```bash
   heroku config:set GITHUB_TOKEN=your_token
   heroku config:set TARGET_REPOS=org/repo1,org/repo2
   heroku config:set GITHUB_CLIENT_ID=your_client_id
   heroku config:set GITHUB_CLIENT_SECRET=your_secret
   heroku config:set SECRET_KEY=$(python -c "import os; print(os.urandom(24).hex())")
   ```

3. **Update OAuth app** - Change callback URL to Heroku URL

See [HEROKU.md](HEROKU.md) for detailed deployment instructions.

## Getting Help

- 📖 [Main README](README.md)
- 🚀 [Heroku Deployment](HEROKU.md)
- 🐛 [Report Issues](https://github.com/johan-droid/Bob/issues)
- 💬 [Discussions](https://github.com/johan-droid/Bob/discussions)

## Next Steps

1. ✅ Complete local setup
2. ✅ Test GitHub OAuth login
3. ✅ Verify PR scanning works
4. ✅ Test WebSocket updates
5. ✅ Make your changes
6. ✅ Test thoroughly
7. ✅ Deploy to Heroku

---

**Happy coding! 🤖**
