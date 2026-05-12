# 🚨 HEROKU BUILDPACK FIX

If you're seeing this error:
```
ERROR: Application not supported by 'heroku/nodejs' buildpack
```

## Quick Fix

Your Heroku app has the wrong buildpack configured. Follow these steps:

### Step 1: Run the Fix Script

**Linux/Mac:**
```bash
chmod +x fix-heroku-buildpack.sh
./fix-heroku-buildpack.sh YOUR_APP_NAME
```

**Windows:**
```bash
fix-heroku-buildpack.bat YOUR_APP_NAME
```

Replace `YOUR_APP_NAME` with your actual Heroku app name.

### Step 2: Redeploy

```bash
git push heroku main
```

If that doesn't work, force a redeploy:
```bash
git commit --allow-empty -m "Redeploy with Python buildpack"
git push heroku main
```

## Manual Fix (Alternative)

If the script doesn't work, run these commands manually:

```bash
# Replace YOUR_APP_NAME with your actual app name
heroku buildpacks:clear -a YOUR_APP_NAME
heroku buildpacks:set heroku/python -a YOUR_APP_NAME
heroku buildpacks -a YOUR_APP_NAME
git push heroku main
```

## Why This Happens

Heroku tries to auto-detect your app type. Sometimes it incorrectly detects Node.js instead of Python. The fix scripts explicitly set the Python buildpack.

## Verify It's Fixed

After running the fix:

```bash
# Check buildpack (should show heroku/python)
heroku buildpacks -a YOUR_APP_NAME

# Deploy
git push heroku main

# Check logs
heroku logs --tail -a YOUR_APP_NAME
```

## Still Having Issues?

1. Check [HEROKU_TROUBLESHOOTING.md](HEROKU_TROUBLESHOOTING.md)
2. Open an issue: https://github.com/johan-droid/Bob/issues
3. Heroku support: https://help.heroku.com/

---

**Quick Commands Reference:**

```bash
# Clear buildpacks
heroku buildpacks:clear -a YOUR_APP_NAME

# Set Python buildpack
heroku buildpacks:set heroku/python -a YOUR_APP_NAME

# Verify
heroku buildpacks -a YOUR_APP_NAME

# Deploy
git push heroku main

# View logs
heroku logs --tail -a YOUR_APP_NAME
```
