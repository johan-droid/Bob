# Heroku Deployment Guide

Deploy Bob to Heroku in minutes with this step-by-step guide.

## Prerequisites

1. **Heroku Account** - [Sign up here](https://signup.heroku.com/)
2. **Heroku CLI** - [Install here](https://devcenter.heroku.com/articles/heroku-cli)
3. **GitHub Account** - For OAuth authentication
4. **GitHub Personal Access Token** - [Generate here](https://github.com/settings/tokens)

## Quick Deploy

### Option 1: Deploy Button (Easiest)

Click the button below to deploy Bob to Heroku:

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/johan-droid/Bob)

### Option 2: Manual Deployment

#### Step 1: Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the details:
   - **Application name**: Bob PR Monitor
   - **Homepage URL**: `https://your-app-name.herokuapp.com`
   - **Authorization callback URL**: `https://your-app-name.herokuapp.com/callback/github`
4. Click "Register application"
5. Copy the **Client ID** and **Client Secret**

#### Step 2: Login to Heroku

```bash
heroku login
```

#### Step 3: Create Heroku App

```bash
# Create app with a custom name
heroku create your-app-name

# Or let Heroku generate a name
heroku create
```

#### Step 4: Set Environment Variables

```bash
# Required: GitHub Personal Access Token
heroku config:set GITHUB_TOKEN=ghp_your_token_here

# Required: Target repositories (comma-separated)
heroku config:set TARGET_REPOS=org/repo1,org/repo2,org/repo3

# Required: GitHub OAuth credentials
heroku config:set GITHUB_CLIENT_ID=your_client_id
heroku config:set GITHUB_CLIENT_SECRET=your_client_secret

# Required: Flask secret key
heroku config:set SECRET_KEY=$(python -c "import os; print(os.urandom(24).hex())")

# Optional: Scan interval (default: 300 seconds)
heroku config:set SCAN_INTERVAL=300
```

#### Step 5: Deploy to Heroku

```bash
# Push to Heroku
git push heroku main

# Or if you're on a different branch
git push heroku your-branch:main
```

#### Step 6: Open Your App

```bash
heroku open
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes | GitHub PAT with repo, issues:write, pull_requests:write scopes |
| `TARGET_REPOS` | Yes | Comma-separated list of repos (e.g., owner/repo1,owner/repo2) |
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth App Client Secret |
| `SECRET_KEY` | Yes | Flask secret key (auto-generated) |
| `SCAN_INTERVAL` | No | Background scan interval in seconds (default: 300) |

### Update Environment Variables

```bash
# View current config
heroku config

# Update a variable
heroku config:set GITHUB_TOKEN=new_token

# Remove a variable
heroku config:unset VARIABLE_NAME
```

## Monitoring

### View Logs

```bash
# View real-time logs
heroku logs --tail

# View last 100 lines
heroku logs -n 100

# Filter logs
heroku logs --source app
```

### Check App Status

```bash
# View app info
heroku apps:info

# View dyno status
heroku ps

# Restart app
heroku restart
```

## Scaling

### Upgrade Dyno

```bash
# Upgrade to Hobby dyno ($7/month)
heroku ps:scale web=1:hobby

# Upgrade to Standard-1X ($25/month)
heroku ps:scale web=1:standard-1x
```

### Free Tier Limitations

- Sleeps after 30 minutes of inactivity
- 550-1000 free dyno hours per month
- WebSocket connections may disconnect

**Recommendation**: Use Hobby dyno or higher for production.

## Custom Domain

### Add Custom Domain

```bash
# Add domain
heroku domains:add www.yourdomain.com

# View DNS targets
heroku domains
```

### Configure DNS

Add a CNAME record:
```
CNAME: www.yourdomain.com → your-app-name.herokuapp.com
```

### Enable SSL

```bash
# SSL is automatic on Heroku
# Verify SSL
heroku certs:auto
```

## Troubleshooting

### App Crashes on Startup

```bash
# Check logs
heroku logs --tail

# Common issues:
# 1. Missing environment variables
heroku config

# 2. Port binding issue (should use PORT env var)
# 3. Missing dependencies
```

### WebSocket Connection Issues

```bash
# Ensure eventlet is installed
pip freeze | grep eventlet

# Check Procfile
cat Procfile
# Should be: web: cd backend && gunicorn --worker-class eventlet -w 1 api_server:app
```

### GitHub OAuth Not Working

1. Verify OAuth app callback URL matches Heroku app URL
2. Check `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set
3. Ensure callback URL is: `https://your-app.herokuapp.com/callback/github`

### Rate Limiting

```bash
# Use organization-level PAT for higher limits
# Check rate limit:
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/rate_limit
```

## Database Persistence (Optional)

For production, add PostgreSQL:

```bash
# Add Heroku Postgres
heroku addons:create heroku-postgresql:mini

# View database URL
heroku config:get DATABASE_URL
```

Update `api_server.py` to use PostgreSQL instead of in-memory storage.

## Backup and Recovery

### Backup Configuration

```bash
# Export config
heroku config -s > .env.heroku

# Backup code
git push backup main
```

### Restore

```bash
# Restore config
cat .env.heroku | xargs heroku config:set

# Rollback release
heroku releases
heroku rollback v123
```

## Cost Optimization

### Free Tier
- **Cost**: $0/month
- **Limitations**: Sleeps after 30 min, 550-1000 hours/month
- **Best for**: Testing, personal use

### Hobby Tier
- **Cost**: $7/month
- **Benefits**: No sleeping, SSL, custom domains
- **Best for**: Small teams, side projects

### Standard Tier
- **Cost**: $25+/month
- **Benefits**: Better performance, metrics, autoscaling
- **Best for**: Production use, larger teams

## Security Best Practices

1. **Rotate tokens regularly**
```bash
heroku config:set GITHUB_TOKEN=new_token
```

2. **Use organization-level PAT**
3. **Enable 2FA on Heroku account**
4. **Review access logs regularly**
```bash
heroku logs --source app | grep "login"
```

5. **Keep dependencies updated**
```bash
pip list --outdated
```

## Support

- **Heroku Status**: https://status.heroku.com/
- **Heroku Support**: https://help.heroku.com/
- **Bob Issues**: https://github.com/johan-droid/Bob/issues

## Next Steps

1. ✅ Deploy to Heroku
2. ✅ Configure GitHub OAuth
3. ✅ Set environment variables
4. ✅ Test login and dashboard
5. ✅ Monitor logs for errors
6. ✅ Upgrade dyno if needed
7. ✅ Add custom domain (optional)

---

**Need help?** Open an issue on [GitHub](https://github.com/johan-droid/Bob/issues)
