# Heroku Deployment - Troubleshooting Guide

## Issue: Wrong Buildpack Detected

If you see an error about Node.js buildpack when deploying a Python app:

```
ERROR: Application not supported by 'heroku/nodejs' buildpack
```

### Solution 1: Set Buildpack via Heroku CLI

```bash
# Clear existing buildpacks
heroku buildpacks:clear -a your-app-name

# Set Python buildpack
heroku buildpacks:set heroku/python -a your-app-name

# Verify
heroku buildpacks -a your-app-name
```

### Solution 2: Use heroku.yml

The repository now includes `heroku.yml` which explicitly sets Python:

```yaml
build:
  languages:
    - python
run:
  web: cd backend && gunicorn --worker-class eventlet -w 1 api_server:app
```

To use it:

```bash
# Set stack to container
heroku stack:set heroku-24 -a your-app-name

# Deploy
git push heroku main
```

### Solution 3: Manual Deployment

```bash
# 1. Create Heroku app
heroku create your-app-name

# 2. Set buildpack BEFORE first deploy
heroku buildpacks:set heroku/python -a your-app-name

# 3. Set environment variables
heroku config:set GITHUB_TOKEN=your_token -a your-app-name
heroku config:set TARGET_REPOS=org/repo1,org/repo2 -a your-app-name
heroku config:set GITHUB_CLIENT_ID=your_client_id -a your-app-name
heroku config:set GITHUB_CLIENT_SECRET=your_secret -a your-app-name
heroku config:set SECRET_KEY=$(python -c "import os; print(os.urandom(24).hex())") -a your-app-name

# 4. Deploy
git push heroku main
```

## Common Heroku Deployment Issues

### Issue: Port Binding Error

**Error:**
```
Error R10 (Boot timeout) -> Web process failed to bind to $PORT within 60 seconds
```

**Solution:**
Ensure `api_server.py` uses `PORT` environment variable:

```python
port = int(os.getenv('PORT', 5000))
socketio.run(app, host='0.0.0.0', port=port, debug=False)
```

### Issue: Module Not Found

**Error:**
```
ModuleNotFoundError: No module named 'flask_socketio'
```

**Solution:**
Ensure `requirements.txt` is at root level and includes all dependencies:

```bash
# Check requirements.txt exists at root
ls requirements.txt

# Should contain:
requests==2.31.0
python-dotenv==1.0.0
flask==3.0.0
flask-cors==4.0.0
flask-socketio==5.3.5
python-socketio==5.10.0
gunicorn==21.2.0
eventlet==0.33.3
```

### Issue: Application Error

**Error:**
```
Application error
An error occurred in the application and your page could not be served.
```

**Solution:**
Check logs:

```bash
heroku logs --tail -a your-app-name
```

Common causes:
1. Missing environment variables
2. Import errors
3. Port binding issues
4. Database connection errors

### Issue: WebSocket Connection Failed

**Error:**
Browser console shows WebSocket connection errors.

**Solution:**

1. Ensure eventlet worker is used in Procfile:
   ```
   web: cd backend && gunicorn --worker-class eventlet -w 1 api_server:app
   ```

2. Check CORS settings in `api_server.py`:
   ```python
   socketio = SocketIO(app, cors_allowed_origins="*")
   ```

3. Verify frontend uses dynamic WebSocket URL:
   ```javascript
   const wsUrl = window.location.hostname === 'localhost' 
       ? 'http://localhost:5000' 
       : window.location.origin;
   const socket = io(wsUrl);
   ```

### Issue: GitHub OAuth Not Working

**Error:**
OAuth callback fails or redirects to wrong URL.

**Solution:**

1. Update GitHub OAuth App settings:
   - Homepage URL: `https://your-app-name.herokuapp.com`
   - Callback URL: `https://your-app-name.herokuapp.com/callback/github`

2. Verify environment variables:
   ```bash
   heroku config:get GITHUB_CLIENT_ID -a your-app-name
   heroku config:get GITHUB_CLIENT_SECRET -a your-app-name
   ```

3. Check session secret is set:
   ```bash
   heroku config:get SECRET_KEY -a your-app-name
   ```

## Deployment Checklist

Before deploying to Heroku:

- [ ] `requirements.txt` exists at root level
- [ ] `Procfile` exists at root level
- [ ] `runtime.txt` specifies Python version
- [ ] Python buildpack is set
- [ ] All environment variables are configured
- [ ] GitHub OAuth app callback URL matches Heroku URL
- [ ] Code is committed and pushed to GitHub

## Verify Deployment

After deployment:

```bash
# 1. Check app is running
heroku ps -a your-app-name

# 2. Check logs
heroku logs --tail -a your-app-name

# 3. Test health endpoint
curl https://your-app-name.herokuapp.com/api/health

# 4. Open app
heroku open -a your-app-name
```

## Useful Heroku Commands

```bash
# View app info
heroku apps:info -a your-app-name

# View config vars
heroku config -a your-app-name

# Set config var
heroku config:set KEY=value -a your-app-name

# Restart app
heroku restart -a your-app-name

# View logs
heroku logs --tail -a your-app-name

# Run bash
heroku run bash -a your-app-name

# Scale dynos
heroku ps:scale web=1 -a your-app-name

# View buildpacks
heroku buildpacks -a your-app-name
```

## Getting Help

If you're still having issues:

1. Check Heroku status: https://status.heroku.com/
2. Review logs: `heroku logs --tail -a your-app-name`
3. Check GitHub issues: https://github.com/johan-droid/Bob/issues
4. Heroku support: https://help.heroku.com/

## Quick Fix Commands

```bash
# Reset buildpack
heroku buildpacks:clear -a your-app-name
heroku buildpacks:set heroku/python -a your-app-name

# Restart app
heroku restart -a your-app-name

# Force redeploy
git commit --allow-empty -m "Force redeploy"
git push heroku main

# Check Python version
heroku run python --version -a your-app-name

# Check installed packages
heroku run pip list -a your-app-name
```

---

**Still stuck?** Open an issue: https://github.com/johan-droid/Bob/issues
