# 🚀 Deploy Bob to Heroku

Bob is now ready for one-click deployment to Heroku!

## Quick Deploy

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/johan-droid/Bob)

## What You'll Need

Before deploying, prepare:

1. **GitHub Personal Access Token**
   - Go to: https://github.com/settings/tokens
   - Scopes needed: `repo`, `issues:write`, `pull_requests:write`

2. **GitHub OAuth App**
   - Go to: https://github.com/settings/developers
   - Create new OAuth App
   - Homepage URL: `https://your-app-name.herokuapp.com`
   - Callback URL: `https://your-app-name.herokuapp.com/callback/github`
   - Copy Client ID and Client Secret

3. **Target Repositories**
   - List of repos to monitor (e.g., `owner/repo1,owner/repo2`)

## Features

✅ **Beautiful Landing Page** - Professional landing page with GitHub sign-in
✅ **GitHub OAuth** - Secure authentication with GitHub
✅ **Real-time Dashboard** - WebSocket-powered updates
✅ **Mobile Optimized** - Works perfectly on all devices
✅ **Auto-scaling** - Heroku handles scaling automatically
✅ **SSL Included** - HTTPS enabled by default

## Deployment Steps

### Option 1: One-Click Deploy

1. Click the "Deploy to Heroku" button above
2. Fill in the required environment variables
3. Click "Deploy app"
4. Wait for deployment to complete
5. Click "View" to open your app

### Option 2: Manual Deploy

See [HEROKU.md](HEROKU.md) for detailed manual deployment instructions.

## Post-Deployment

After deployment:

1. **Update OAuth App**
   - Go back to your GitHub OAuth App settings
   - Update Homepage URL to your Heroku app URL
   - Update Callback URL to `https://your-app.herokuapp.com/callback/github`

2. **Test Login**
   - Visit your Heroku app
   - Click "Sign in with GitHub"
   - Authorize the app
   - You should see the dashboard

3. **Monitor Logs**
   ```bash
   heroku logs --tail -a your-app-name
   ```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | ✅ | GitHub PAT for API access |
| `TARGET_REPOS` | ✅ | Repos to monitor (comma-separated) |
| `GITHUB_CLIENT_ID` | ✅ | OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | ✅ | OAuth App Client Secret |
| `SECRET_KEY` | ✅ | Auto-generated session key |
| `SCAN_INTERVAL` | ❌ | Scan interval (default: 300s) |

## Upgrading

To upgrade your Heroku dyno:

```bash
# Hobby dyno ($7/month) - No sleeping
heroku ps:scale web=1:hobby -a your-app-name

# Standard-1X ($25/month) - Better performance
heroku ps:scale web=1:standard-1x -a your-app-name
```

## Support

- 📖 [Full Documentation](README.md)
- 🚀 [Heroku Deployment Guide](HEROKU.md)
- 🐛 [Report Issues](https://github.com/johan-droid/Bob/issues)
- 💬 [Discussions](https://github.com/johan-droid/Bob/discussions)

---

**Made with ❤️ by the Bob team**
