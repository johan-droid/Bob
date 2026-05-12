# Multi-Repo PR Health Scanner - Implementation Complete

## Created Files

| File | Purpose |
|------|---------|
| `scanner.yml` | GitHub Actions workflow for multi-repo scanning |
| `pr_health_scanner.py` | Python scanner with merge conflict & CI failure detection |
| `README.md` | Complete documentation |
| `.env.example` | Environment variable template |
| `requirements.txt` | Python dependencies |

## Quick Start

### Option 1: GitHub Actions (Recommended)
1. Push `scanner.yml` to `.github/workflows/` in your scanner repo
2. Add `ORG_PAT` secret with organization-level token
3. Enable workflow - runs every 15 minutes automatically

### Option 2: Local Execution
```bash
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your token and repos
python pr_health_scanner.py
```

## Key Features

✅ **Merge Conflict Detection** - Uses GitHub's mergeable status with retry logic  
✅ **CI Failure Monitoring** - Scans workflow runs for failures  
✅ **Auto-tagging** - Tags `@jules-google-lab` team on issues  
✅ **Label Management** - Adds `needs-fix` label to problematic PRs  
✅ **Multi-repo Support** - Scan multiple repos via matrix strategy  
✅ **Error Resilient** - `fail-fast: false` ensures one failure doesn't stop all scans  

## Architecture Highlights

- **Centralized scheduler** runs on GitHub Actions cron
- **Per-repo health checks** for conflicts and CI failures
- **Alert engine** creates issues and tags team
- **Retry logic** handles rate limits (5 retries, 3s wait)

## Next Steps

1. Configure org-level PAT with required scopes
2. Create `jules-google-lab` GitHub team
3. Deploy scanner.yml to your scanner repository
4. Monitor first scan results
5. Set up dashboard for `needs-fix` issues

## Production Tips

- Use org-level PAT for easier management
- Set `fail-fast: false` to prevent single repo failures
- Monitor GitHub API rate limits
- Consider adding Rosentic for semantic conflict detection
- Add Slack notifications for critical failures
