# 🔐 Environment Configuration

Bob uses a **master `.env` file** at the root for local development.

## 📁 File Structure

```
Bob/
├── .env                    # Master config (LOCAL ONLY - NOT COMMITTED)
├── .env.example           # Template (committed to Git)
├── backend/
│   ├── .env              # Copy of root .env (NOT COMMITTED)
│   └── .env.example      # Backend template (committed)
└── setup-local.sh/bat    # Auto-setup scripts
```

## 🚀 Quick Setup

### 1. Create Local Environment

```bash
# Copy template
cp .env.example .env

# Edit with your credentials
nano .env  # or use your favorite editor
```

### 2. Run Setup Script

**Linux/Mac:**
```bash
chmod +x setup-local.sh
./setup-local.sh
```

**Windows:**
```bash
setup-local.bat
```

### 3. Start Server

```bash
cd backend
python api_server.py
```

## 🔑 Required Variables

```bash
# GitHub API Access
GITHUB_TOKEN=ghp_your_token_here

# Repositories to Monitor
TARGET_REPOS=org/repo1,org/repo2,org/repo3

# GitHub OAuth (for login)
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# Flask Session Security
SECRET_KEY=generate_with_python_command
```

### Generate Secret Key

```bash
python -c "import os; print(os.urandom(24).hex())"
```

## 🌐 Environment-Specific Setup

### Local Development

- Use root `.env` file
- OAuth callback: `http://localhost:5000/callback/github`
- Port: `5000` (default)

### Heroku Production

- **Don't use `.env` files**
- Set via Heroku CLI:
  ```bash
  heroku config:set GITHUB_TOKEN=your_token
  heroku config:set TARGET_REPOS=org/repo1,org/repo2
  heroku config:set GITHUB_CLIENT_ID=your_client_id
  heroku config:set GITHUB_CLIENT_SECRET=your_secret
  heroku config:set SECRET_KEY=$(python -c "import os; print(os.urandom(24).hex())")
  ```
- OAuth callback: `https://your-app.herokuapp.com/callback/github`

## 🔒 Security Notes

### ✅ DO

- Keep `.env` files local only
- Use different OAuth apps for local/production
- Rotate tokens regularly
- Use organization-level PAT for higher rate limits

### ❌ DON'T

- Commit `.env` files to Git
- Share `.env` files in chat/email
- Use production credentials locally
- Hardcode secrets in code

## 📋 Setup Checklist

- [ ] Copy `.env.example` to `.env`
- [ ] Add GitHub Personal Access Token
- [ ] Add target repositories
- [ ] Create GitHub OAuth App
- [ ] Add OAuth credentials to `.env`
- [ ] Generate and add SECRET_KEY
- [ ] Run setup script
- [ ] Test server starts successfully
- [ ] Test GitHub login works
- [ ] Verify PR scanning works

## 🆘 Troubleshooting

### `.env` not found

```bash
# Create from template
cp .env.example .env
```

### OAuth not working

1. Check OAuth app callback URL matches your environment
2. Verify CLIENT_ID and CLIENT_SECRET in `.env`
3. Ensure you're using the correct URL (localhost vs Heroku)

### Backend can't find `.env`

```bash
# Copy root .env to backend
cp .env backend/.env

# Or run setup script
./setup-local.sh  # Linux/Mac
setup-local.bat   # Windows
```

## 📚 Documentation

- [Local Setup Guide](LOCAL_SETUP.md) - Detailed local development setup
- [Heroku Deployment](HEROKU.md) - Production deployment guide
- [Main README](README.md) - Full project documentation

---

**Remember: `.env` files are for LOCAL DEVELOPMENT ONLY and should NEVER be committed to Git!**
