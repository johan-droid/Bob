# Bob PR Health Scanner - Advanced Features Implementation

This document describes the three major feature additions to the Bob PR Health Scanner system.

## 1. Local Dev-Proxy Tunneling (`scripts/webhook-proxy.ts`)

### Purpose
Enable local debugging of GitHub webhook payloads without deploying to production. This is essential for testing the `/api/webhooks/github` endpoint during development.

### Features
- **Local Proxy Server**: Runs on port 8787 (configurable) and forwards webhooks to your Next.js dev server
- **Payload Logging**: All incoming webhooks are logged to `webhook_logs.jsonl` for inspection
- **Replay Capability**: Re-send any captured webhook event for re-testing
- **Signature Verification**: Optional GitHub signature validation in development mode
- **Event Listing**: REST API to list and retrieve captured events

### Setup

1. **Start the proxy server**:
   ```bash
   npx ts-node scripts/webhook-proxy.ts
   # or
   npm run webhook-proxy
   ```

2. **Create an external tunnel** (for GitHub to reach your local machine):
   ```bash
   ngrok http 8787
   ```

3. **Configure GitHub Webhook**:
   - Go to your repository Settings → Webhooks
   - Add payload URL: `https://<ngrok-url>/`
   - Content type: `application/json`
   - Secret: (optional, set `WEBHOOK_SECRET` env var)
   - Events: Select "Pull requests" and "Check suites"

4. **View logs**:
   ```bash
   tail -f webhook_logs.jsonl | jq
   ```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | POST | Receive and forward GitHub webhooks |
| `/events` | GET | List recent webhook events |
| `/events/:id` | GET | Get details of a specific event |
| `/replay` | POST | Replay a webhook event |

### Environment Variables

```bash
LOCAL_DEV_PORT=3000           # Your Next.js dev server port
WEBHOOK_PROXY_PORT=8787       # Proxy server port
WEBHOOK_LOG_FILE=./webhook_logs.jsonl
WEBHOOK_SECRET=your_secret    # Optional for local dev
ALLOW_UNSIGNED_WEBHOOKS=1     # Allow unsigned in development
TUNNEL_URL=https://abc.ngrok.io  # Your ngrok URL
```

---

## 2. Lightweight SLM AI Code Reviews (`lib/slm-reviewer.ts`)

### Purpose
Automatically analyze CI build failures using free Small Language Model (SLM) APIs and post contextual review comments to affected PRs.

### Supported Providers
- **OpenRouter** (recommended): Access to many free models including Gemma, Mistral, Llama
- **HuggingFace Inference API**: Free tier available for popular models
- **Ollama**: Self-hosted local models (completely free)

### How It Works

1. When a CI workflow fails, the scanner detects it
2. Fetches the raw terminal logs from GitHub Actions
3. Extracts error messages using pattern matching
4. Sends errors to SLM for analysis and summary generation
5. Posts an AI-generated comment to the PR with actionable feedback

### Configuration

```bash
# Provider selection
SLM_PROVIDER=openrouter     # 'openrouter', 'huggingface', or 'ollama'

# API Keys (not needed for Ollama)
SLM_API_KEY=your_api_key

# Model selection
SLM_MODEL=google/gemma-2-2b-it:free  # OpenRouter
# SLM_MODEL=mistralai/Mistral-7B-Instruct-v0.3  # HuggingFace
# SLM_MODEL=llama3.2:1b  # Ollama

# Ollama host (if using local Ollama)
OLLAMA_HOST=http://localhost:11434
```

### Usage

#### Manual Trigger
```typescript
import { SLMCodeReviewer } from '@/lib/slm-reviewer';

const reviewer = new SLMCodeReviewer({
  provider: 'openrouter',
  apiKey: process.env.SLM_API_KEY
});

const result = await reviewer.reviewCIFailure(
  userId,
  'owner/repo',
  runId,      // GitHub Actions run ID
  prNumber    // Optional: PR number to comment on
);
```

#### Auto-Trigger from Scan Pipeline
The `triggerAIReviewOnCIFailure()` function can be integrated into the existing scan pipeline to automatically review CI failures.

### Error Pattern Detection

The reviewer automatically detects these error types:
- Compilation errors (SyntaxError, TypeError, etc.)
- Module resolution failures
- Build/test failures
- Runtime exceptions
- Warnings (logged separately)

### Fallback Behavior

If the SLM API is unavailable or rate-limited, the system falls back to a rule-based summary that lists detected errors without AI analysis.

---

## 3. Active Merge Checklist Gates (`lib/merge-gates.ts`)

### Purpose
Provide a structured merge approval workflow with checklist gates and direct squash-and-merge capability from the dashboard.

### Components

#### Merge Checklist Gates
Pre-defined validation checks before merging:
- ✅ CI/CD Passing (required)
- ✅ Code Review Approved (required)
- ✅ No Merge Conflicts (required)
- ⬜ Changes Tested (optional)
- ⬜ Documentation Updated (optional)
- ⬜ Security Review (optional)

#### Merge Approval Contract
When all required gates pass, a contract is stored in the database recording:
- Who approved the merge
- When it was approved
- Which gates were validated
- The intended merge method

#### Squash-and-Merge Execution
Direct merge execution from the dashboard without navigating to GitHub.

### API Endpoints

#### Validate Merge Gates
```http
POST /api/merge-gates
Content-Type: application/json

{
  "repo": "owner/repo",
  "prNumber": 123
}
```

Response:
```json
{
  "valid": true,
  "gates": [
    { "id": "ci_passing", "label": "CI/CD Passing", "checked": true, "required": true },
    { "id": "review_approved", "label": "Code Review Approved", "checked": true, "required": true },
    { "id": "no_conflicts", "label": "No Merge Conflicts", "checked": true, "required": true }
  ],
  "blocking": []
}
```

#### Execute Merge
```http
POST /api/merge-gates?action=execute
Content-Type: application/json

{
  "repo": "owner/repo",
  "prNumber": 123,
  "commitTitle": "Optional custom title",
  "commitMessage": "Optional commit message",
  "autoDeleteBranch": true,
  "skipValidation": false
}
```

#### Get Contract Status
```http
GET /api/merge-gates?repo=owner/repo&prNumber=123
```

### Database Tables

Three new tables support this feature:

1. **merge_contracts**: Stores approval contracts
2. **merge_logs**: Audit log of all merges
3. **ai_review_logs**: Log of AI review actions

### UI Integration

Add a "Merge" button to the dashboard issue cards that:
1. Validates all gates
2. Shows checklist status
3. Enables merge button when all required gates pass
4. Executes squash-and-merge with confirmation dialog

---

## Integration Points

### Connecting SLM Reviews to Scan Pipeline

In `lib/scanner.ts`, modify the `scanAllRepos()` method to trigger AI reviews:

```typescript
// After detecting workflow failures
for (const f of result.workflow_failures) {
  // ... existing issue creation code ...
  
  // Trigger AI review
  if (process.env.SLM_API_KEY) {
    import('@/lib/slm-reviewer').then(({ triggerAIReviewOnCIFailure }) => {
      triggerAIReviewOnCIFailure(userId, repo, f.id);
    });
  }
}
```

### Adding Merge Gates to Dashboard

In the dashboard component, add merge action buttons:

```tsx
<button
  onClick={() => handleValidateMerge(issue.repo, issue.pr_number)}
  disabled={!issue.pr_number}
>
  <span className="material-symbols-outlined">task_alt</span>
  Validate & Merge
</button>
```

---

## Testing

### Webhook Proxy
```bash
# Test with mock payload
curl -X POST http://localhost:8787/ \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -d '{"action":"opened","pull_request":{"number":123},"repository":{"full_name":"test/repo"}}'
```

### SLM Reviewer
```bash
# Test with a known failing run
node -e "
import { SLMCodeReviewer } from './lib/slm-reviewer';
const r = new SLMCodeReviewer();
r.reviewCIFailure(1, 'owner/repo', 12345678);
"
```

### Merge Gates
```bash
# Validate gates
curl -X POST http://localhost:3000/api/merge-gates \
  -H "Content-Type: application/json" \
  -d '{"repo":"owner/repo","prNumber":123}'
```

---

## Security Considerations

1. **Webhook Signatures**: Always verify in production; disable only for local dev
2. **Token Storage**: GitHub tokens remain encrypted; never exposed to client
3. **Rate Limiting**: SLM calls respect GitHub and provider rate limits
4. **CSRF Protection**: All merge operations require valid CSRF tokens

---

## Troubleshooting

### Webhook Proxy Issues
- Ensure ngrok tunnel is active
- Check that `ALLOW_UNSIGNED_WEBHOOKS=1` in development
- Verify local dev server is running on configured port

### SLM Review Failures
- Check API key validity
- Verify model availability (some free models have usage limits)
- For Ollama, ensure service is running: `ollama serve`

### Merge Gate Blocks
- Check GitHub token has `repo` scope
- Verify PR exists and is open
- Ensure no rate limiting from GitHub API
