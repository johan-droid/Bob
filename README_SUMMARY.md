# Multi-Repo PR Health Scanner

Production-grade GitHub PR health monitoring system.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              Centralized Scheduler                  │
│        (GitHub Actions cron - every 15 min)         │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────┐
│       Multi-Repo Iterator    │
│  (reads repo list from env)  │
└──────────┬───────────────────┘
           │ per repo
           ▼
┌──────────────────────────────┐
│   PR Health Checker (per PR)  │
│  ┌──────────────────────┐    │
│  │① Branch Conflict Det. │   │
│  │② Actions Failure Det. │   │
│  └──────────────────────┘    │
└──────────┬───────────────────┘
           │ failed
           ▼
┌──────────────────────────────┐
│    Alert & Tag Engine         │
│  - Labels PR with "needs-fix" │
│  - Comments @jules-google-lab │
│  - Opens issue if critical    │
└──────────────────────────────┘
```

## Quick Start

### GitHub Actions (Recommended)
1. Push `scanner.yml` to `.github/workflows/`
2. Add `ORG_PAT` secret with org-level token
3. Enable workflow - runs every 15 minutes

### Local Execution
```bash
pip install -r requirements.txt
cp .env.example .env
python pr_health_scanner.py
```

## Features

✅ Merge conflict detection with retry logic  
✅ CI failure monitoring  
✅ Auto-tagging `@jules-google-lab` team  
✅ `needs-fix` label management  
✅ Multi-repo scanning via matrix strategy  

## Files

| File | Purpose |
|------|---------|
| [scanner.yml](scanner.yml) | GitHub Actions workflow |
| [pr_health_scanner.py](pr_health_scanner.py) | Python scanner |
| [README.md](README.md) | Full documentation |
| [IMPLEMENTATION.md](IMPLEMENTATION.md) | Quick start guide |
