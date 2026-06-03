# Bob Backend - PR Health Scanner with WebSocket

Flask server with WebSocket updates for PR health monitoring.

## Setup

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. Configure environment:

```bash
cp .env.example .env
# Edit .env with your GitHub and queue settings
```

3. Start web server:

```bash
python api_server.py
```

Server runs on `http://localhost:5000`.

## Features

- WebSocket support for real-time dashboard updates
- GitHub webhook-driven repo scans
- RQ background queue for scan execution
- Daily fallback sync trigger endpoint for stale repos

## REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/scan` | Queue manual scan for logged-in user |
| POST | `/api/webhooks/github` | GitHub webhook receiver |
| POST | `/api/internal/fallback-sync` | Queue daily fallback sync (internal token required) |
| POST | `/api/actions/rebase` | Dry-run action contract for PR rebase |
| POST | `/api/actions/approve-merge` | Dry-run action contract for approve+merge |

## Repo Policy as Code

Bob supports repository-level configuration via `.bob.yml` in each repository root.

Example:

```yaml
policy:
  required_checks:
    - ci/test
    - ci/lint
  required_approvals: 2
  stale_hours: 24
```

Policy is validated on load. If invalid, Bob falls back to defaults and publishes a failing merge-readiness check with validation details.

## GitHub Checks API

Bob publishes `bob/merge-readiness` check runs on PR head commits. Evaluation uses:

- `required_checks` from `.bob.yml`
- `required_approvals` from `.bob.yml`
- Current check-run conclusions and PR review approvals

## Background Jobs (RQ)

The web process only enqueues jobs. RQ worker processes execute scans.

### Required Environment Variables

- `REDIS_URL`: Redis connection string used by RQ
- `INTERNAL_CRON_TOKEN`: Shared secret for triggering fallback sync jobs
- `TOKEN_ENCRYPTION_KEY`: Fernet key used to encrypt/decrypt stored GitHub OAuth tokens
- `WEBHOOK_SECRET`: GitHub webhook signing secret; unsigned requests are rejected
- `RQ_QUEUE_NAME` (optional): Queue name, defaults to `bob-jobs`

### Run Worker

```bash
cd backend
rq worker bob-jobs --url "$REDIS_URL"
```

### Daily Fallback Sync

Use an external cron (Heroku Scheduler, Render Cron, Kubernetes CronJob, etc.) to call:

```bash
curl -X POST "$PUBLIC_BASE_URL/api/internal/fallback-sync" \
  -H "X-Internal-Token: $INTERNAL_CRON_TOKEN"
```

Webhooks are the primary update path; fallback sync is a safety net for stale repositories.
