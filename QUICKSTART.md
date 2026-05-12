# 🚀 Bob Quick Start Guide

## Setup (2 minutes)

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment
```bash
cd backend
cp .env.example .env
```

Edit `.env`:
```bash
GITHUB_TOKEN=your_github_pat_here
TARGET_REPOS=org/repo1,org/repo2,org/repo3
```

### 3. Start Server
```bash
cd backend
python api_server.py
```

### 4. Open Dashboard
Open browser: `http://localhost:5000`

That's it! No API keys, no separate frontend server needed.

## Features

✅ **Real-time Updates** - WebSocket connection for instant PR status changes
✅ **Mobile Optimized** - Works perfectly on phones and tablets
✅ **No API Keys** - Direct WebSocket connection, no authentication needed
✅ **Auto-Scanning** - Background scanning every 5 minutes
✅ **Connection Status** - Visual indicator shows connection state

## Status Indicators

- 🔴 **Red Dot** - PRs awaiting resolution
- 🟢 **Green Glowing** - PRs being worked on
- 🔴 **Red Glowing** - Failed resolutions
- ⚪ **Grey Glowing** - Successfully resolved

## Troubleshooting

**Connection Status Red?**
- Check backend is running: `python api_server.py`
- Verify port 5000 is not in use

**No PRs showing?**
- Wait for initial scan (5 minutes)
- Or trigger manual scan: `POST http://localhost:5000/api/scan`

**Mobile view not working?**
- Clear browser cache
- Ensure viewport meta tags are present

## Next Steps

1. Deploy `scanner.yml` to GitHub Actions for automated scanning
2. Configure `jules-google-lab` team in your GitHub organization
3. Monitor dashboard for PR health issues
