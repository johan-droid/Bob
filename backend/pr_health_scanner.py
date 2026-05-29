"""pr_health_scanner.py — Industry-grade PR health scanner with review tracking,
PR age/staleness analysis, settings-aware behavior, and dedup/rate-limit awareness."""
import os, time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

try:
    from .logger import get_logger
except ImportError:
    try:
        from logger import get_logger
    except ImportError:
        import logging
        def get_logger(name):
            return logging.getLogger(name)

logger = get_logger(__name__)

GITHUB_API = "https://api.github.com"


class PRHealthScanner:
    def __init__(self, token: str, repos: List[str], assignee: str = 'jules',
                 auto_label_conflict: bool = True, tag_author_on_fail: bool = False):
        self.token = token
        self.repos = repos
        self.assignee = assignee
        self.auto_label_conflict = auto_label_conflict
        self.tag_author_on_fail = tag_author_on_fail

        # Use stdlib urllib to avoid requests dependency mismatch with api_server
        import requests
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'token {token}',
            'Accept': 'application/vnd.github.v3+json',
        })

    def _get(self, url: str, params: dict = None, retries: int = 4) -> Any:
        for attempt in range(retries):
            try:
                r = self.session.get(url, params=params, timeout=15)
                remaining = int(r.headers.get('X-RateLimit-Remaining', 999))
                if remaining < 10:
                    reset_at = int(r.headers.get('X-RateLimit-Reset', time.time() + 60))
                    wait = max(0, reset_at - time.time()) + 2
                    logger.warning(f"Rate limit low ({remaining}), sleeping {wait:.0f}s")
                    time.sleep(wait)
                if r.status_code == 200:
                    return r.json()
                if r.status_code in (403, 429):
                    time.sleep((attempt + 1) * 3)
                    continue
                return {'error': f'HTTP {r.status_code}'}
            except Exception as e:
                if attempt == retries - 1:
                    return {'error': str(e)}
                time.sleep(3)
        return {'error': 'Max retries exceeded'}

    def _post(self, url: str, json_data: dict) -> Any:
        try:
            r = self.session.post(url, json=json_data, timeout=10)
            return r.json()
        except Exception as e:
            return {'error': str(e)}

    # ── Dedup: check if open issue with same title prefix exists ───────────────
    def _issue_exists(self, repo: str, title_prefix: str) -> bool:
        result = self._get(f'{GITHUB_API}/repos/{repo}/issues',
                           params={'state': 'open', 'labels': 'needs-fix', 'per_page': 50})
        if isinstance(result, list):
            return any(i.get('title', '').startswith(title_prefix) for i in result)
        return False

    def get_open_prs(self, repo: str) -> List[Dict]:
        result = self._get(f'{GITHUB_API}/repos/{repo}/pulls',
                           params={'state': 'open', 'per_page': 100})
        return result if isinstance(result, list) else []

    def check_merge_conflict(self, repo: str, pr_number: int) -> bool:
        pr = self._get(f'{GITHUB_API}/repos/{repo}/pulls/{pr_number}')
        return isinstance(pr, dict) and pr.get('mergeable') == False  # noqa: E712

    # ── NEW: PR Review Status Tracking ────────────────────────────────────────
    def get_pr_reviews(self, repo: str, pr_number: int) -> Dict:
        """Fetch review status for a PR. Returns aggregated review state."""
        result = self._get(f'{GITHUB_API}/repos/{repo}/pulls/{pr_number}/reviews')
        if not isinstance(result, list):
            return {'status': 'unknown', 'reviewers': [], 'approved_count': 0,
                    'changes_requested_count': 0, 'pending_count': 0}

        # Build latest review per reviewer (most recent wins)
        latest_reviews = {}
        for review in result:
            reviewer = review.get('user', {}).get('login', '')
            state = review.get('state', '').upper()
            if reviewer and state in ('APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED'):
                latest_reviews[reviewer] = {
                    'reviewer': reviewer,
                    'state': state,
                    'submitted_at': review.get('submitted_at'),
                    'avatar': review.get('user', {}).get('avatar_url', ''),
                }

        reviewers = list(latest_reviews.values())
        approved = sum(1 for r in reviewers if r['state'] == 'APPROVED')
        changes_req = sum(1 for r in reviewers if r['state'] == 'CHANGES_REQUESTED')

        # Fetch requested reviewers (people who haven't reviewed yet)
        req_result = self._get(f'{GITHUB_API}/repos/{repo}/pulls/{pr_number}/requested_reviewers')
        pending_reviewers = []
        if isinstance(req_result, dict):
            for user in req_result.get('users', []):
                pending_reviewers.append({
                    'reviewer': user.get('login', ''),
                    'state': 'PENDING',
                    'submitted_at': None,
                    'avatar': user.get('avatar_url', ''),
                })

        all_reviewers = reviewers + pending_reviewers

        # Determine overall review status
        if changes_req > 0:
            overall = 'changes_requested'
        elif approved > 0 and len(pending_reviewers) == 0:
            overall = 'approved'
        elif len(all_reviewers) > 0:
            overall = 'review_pending'
        else:
            overall = 'no_reviewers'

        return {
            'status': overall,
            'reviewers': all_reviewers,
            'approved_count': approved,
            'changes_requested_count': changes_req,
            'pending_count': len(pending_reviewers),
        }

    # ── NEW: PR Age & Staleness Analysis ──────────────────────────────────────
    @staticmethod
    def compute_pr_age(pr: Dict) -> Dict:
        """Compute PR age metrics: days open, days since last update, staleness category."""
        now = datetime.now(timezone.utc)
        created_str = pr.get('created_at', '')
        updated_str = pr.get('updated_at', '')

        days_open = 0
        days_since_update = 0

        if created_str:
            try:
                created = datetime.fromisoformat(created_str.replace('Z', '+00:00'))
                days_open = (now - created).days
            except (ValueError, TypeError):
                pass

        if updated_str:
            try:
                updated = datetime.fromisoformat(updated_str.replace('Z', '+00:00'))
                days_since_update = (now - updated).days
            except (ValueError, TypeError):
                pass

        # Staleness categories
        if days_since_update >= 14:
            staleness = 'abandoned'
        elif days_since_update >= 7:
            staleness = 'stale'
        elif days_since_update >= 3:
            staleness = 'aging'
        else:
            staleness = 'active'

        # Size category (if additions/deletions are available)
        additions = pr.get('additions', 0)
        deletions = pr.get('deletions', 0)
        total_changes = additions + deletions

        if total_changes > 1000:
            size = 'xl'
        elif total_changes > 500:
            size = 'large'
        elif total_changes > 100:
            size = 'medium'
        else:
            size = 'small'

        return {
            'days_open': days_open,
            'days_since_update': days_since_update,
            'staleness': staleness,
            'additions': additions,
            'deletions': deletions,
            'total_changes': total_changes,
            'size': size,
        }

    # ── NEW: PR Detail Fetch (includes additions/deletions) ───────────────────
    def get_pr_detail(self, repo: str, pr_number: int) -> Dict:
        """Fetch full PR details including line counts for size analysis."""
        result = self._get(f'{GITHUB_API}/repos/{repo}/pulls/{pr_number}')
        return result if isinstance(result, dict) and 'error' not in result else {}

    def scan_workflow_failures(self, repo: str) -> List[Dict]:
        result = self._get(f'{GITHUB_API}/repos/{repo}/actions/runs',
                           params={'status': 'failure', 'per_page': 10})
        if not isinstance(result, dict):
            return []
        return [
            {'id': r.get('id'), 'name': r.get('name'), 'conclusion': r.get('conclusion'),
             'branch': r.get('head_branch'), 'html_url': r.get('html_url'),
             'created_at': r.get('created_at'),
             'author': r.get('triggering_actor', {}).get('login') or r.get('head_commit', {}).get('author', {}).get('name') or 'github-actions'}
            for r in result.get('workflow_runs', [])
        ]

    def create_issue(self, repo: str, title: str, body: str, labels: List[str]) -> Dict:
        # Dedup: don't create if similar open issue exists
        if self._issue_exists(repo, title[:60]):
            return {'skipped': True, 'reason': 'duplicate'}
        return self._post(f'{GITHUB_API}/repos/{repo}/issues',
                          {'title': title, 'body': body, 'labels': labels})

    def add_label(self, repo: str, pr_number: int, label: str) -> Dict:
        return self._post(f'{GITHUB_API}/repos/{repo}/issues/{pr_number}/labels',
                          {'labels': [label]})

    def create_comment(self, repo: str, pr_number: int, body: str) -> Dict:
        return self._post(f'{GITHUB_API}/repos/{repo}/issues/{pr_number}/comments',
                          {'body': body})

    # ── NEW: Re-run CI workflow ───────────────────────────────────────────────
    def rerun_workflow(self, repo: str, run_id: int) -> Dict:
        """Trigger a re-run of a failed GitHub Actions workflow."""
        try:
            r = self.session.post(
                f'{GITHUB_API}/repos/{repo}/actions/runs/{run_id}/rerun-failed-jobs',
                timeout=10
            )
            if r.status_code in (201, 204):
                return {'success': True}
            return {'error': f'HTTP {r.status_code}'}
        except Exception as e:
            return {'error': str(e)}

    # ── NEW: Assign reviewer to PR ────────────────────────────────────────────
    def request_review(self, repo: str, pr_number: int, reviewers: List[str]) -> Dict:
        """Request review from specified GitHub users."""
        return self._post(
            f'{GITHUB_API}/repos/{repo}/pulls/{pr_number}/requested_reviewers',
            {'reviewers': reviewers}
        )

    def scan_repository(self, repo: str) -> Dict:
        """Full repository scan with reviews, age tracking, and settings-aware labeling."""
        results = {
            'repo': repo,
            'conflicting_prs': [],
            'workflow_failures': [],
            'review_issues': [],
            'stale_prs': [],
            'oversized_prs': [],
            'total_prs': 0,
            'healthy_prs': 0,
        }

        prs = self.get_open_prs(repo)
        results['total_prs'] = len(prs)

        for pr in prs:
            pr_num = pr.get('number')
            pr_title = pr.get('title', 'Untitled')
            pr_url = pr.get('html_url', '')
            pr_author = pr.get('user', {}).get('login', 'Unknown')
            head_branch = pr.get('head', {}).get('ref', '')
            has_issues = False

            # 1. Merge conflict detection
            if self.check_merge_conflict(repo, pr_num):
                results['conflicting_prs'].append({
                    'pr': pr_num, 'title': pr_title,
                    'url': pr_url, 'head_branch': head_branch,
                    'author': pr_author
                })
                has_issues = True

            # 2. Review status tracking (NEW)
            review_info = self.get_pr_reviews(repo, pr_num)
            if review_info['status'] == 'changes_requested':
                results['review_issues'].append({
                    'pr': pr_num, 'title': pr_title,
                    'url': pr_url, 'head_branch': head_branch,
                    'author': pr_author,
                    'review_status': review_info['status'],
                    'reviewers': review_info['reviewers'],
                    'approved_count': review_info['approved_count'],
                    'changes_requested_count': review_info['changes_requested_count'],
                    'pending_count': review_info['pending_count'],
                })
                has_issues = True

            # 3. PR age/staleness tracking (NEW)
            pr_detail = self.get_pr_detail(repo, pr_num)
            age_info = self.compute_pr_age(pr_detail or pr)

            if age_info['staleness'] in ('stale', 'abandoned'):
                results['stale_prs'].append({
                    'pr': pr_num, 'title': pr_title,
                    'url': pr_url, 'head_branch': head_branch,
                    'author': pr_author,
                    'days_open': age_info['days_open'],
                    'days_since_update': age_info['days_since_update'],
                    'staleness': age_info['staleness'],
                })
                has_issues = True

            # 4. PR size analysis (NEW)
            if age_info['size'] in ('large', 'xl'):
                results['oversized_prs'].append({
                    'pr': pr_num, 'title': pr_title,
                    'url': pr_url, 'head_branch': head_branch,
                    'author': pr_author,
                    'additions': age_info['additions'],
                    'deletions': age_info['deletions'],
                    'total_changes': age_info['total_changes'],
                    'size': age_info['size'],
                })
                has_issues = True

            if not has_issues:
                results['healthy_prs'] += 1

        # 5. CI failure scanning
        results['workflow_failures'] = self.scan_workflow_failures(repo)

        return results

    def scan_all_repos(self) -> List[Dict]:
        all_results = []
        for repo in self.repos:
            logger.info(f'Scanning {repo}…')
            result = self.scan_repository(repo)
            all_results.append(result)

            for cp in result['conflicting_prs']:
                title = f"🚨 Merge conflict in PR #{cp['pr']}"
                body  = (f"@{self.assignee} merge conflict detected.\n\n"
                         f"Branch `{cp['head_branch']}` conflicts with base.\n\nPR: {cp['url']}")
                self.create_issue(repo, title, body, ['needs-fix', 'merge-conflict'])

                # Settings-aware: only label if auto_label_conflict is enabled
                if self.auto_label_conflict:
                    self.add_label(repo, cp['pr'], 'needs-fix')

            for f in result['workflow_failures']:
                title = f"⚠️ Workflow '{f['name']}' failed on {f['branch']}"
                body = f"@{self.assignee} please investigate: {f['html_url']}"

                # Settings-aware: tag author if enabled
                if self.tag_author_on_fail and f.get('author'):
                    body = f"@{f['author']} @{self.assignee} please investigate: {f['html_url']}"

                self.create_issue(repo, title, body, ['needs-fix', 'ci-failure'])

        return all_results


def main():
    from dotenv import load_dotenv
    load_dotenv()
    token    = os.getenv('GITHUB_TOKEN')
    raw      = os.getenv('TARGET_REPOS', '')
    repos    = [r.strip() for r in raw.split(',') if r.strip()]
    assignee = os.getenv('ASSIGNEE_USERNAME', 'jules')
    
    if not token:
        logger.error('Set GITHUB_TOKEN in environment')
        raise SystemExit(1)

    if not repos:
        logger.info('TARGET_REPOS is not set in environment. Querying GitHub API for repositories...')
        try:
            import requests
            headers = {
                'Authorization': f'token {token}',
                'Accept': 'application/vnd.github.v3+json',
            }
            # Fetch repos where the authenticated user is the owner or collaborator
            r = requests.get(f'{GITHUB_API}/user/repos', headers=headers, params={'per_page': 100}, timeout=15)
            if r.status_code == 200:
                repos = [repo['full_name'] for repo in r.json() if 'full_name' in repo]
                logger.info(f"Dynamically discovered {len(repos)} repositories: {repos}")
            else:
                logger.error(f"Failed to fetch repositories dynamically: HTTP {r.status_code} - {r.text}")
        except Exception as e:
            logger.error(f"Error fetching repositories dynamically: {e}")

    if not repos:
        logger.error('No repositories to scan. Please set TARGET_REPOS or grant access to repositories.')
        raise SystemExit(1)

    scanner = PRHealthScanner(token, repos, assignee=assignee)
    results = scanner.scan_all_repos()
    for r in results:
        logger.info(f"\n{r['repo']}: {r['total_prs']} PRs, "
              f"{len(r['conflicting_prs'])} conflicts, "
              f"{len(r['workflow_failures'])} CI failures, "
              f"{len(r['review_issues'])} review issues, "
              f"{len(r['stale_prs'])} stale PRs, "
              f"{len(r['oversized_prs'])} oversized PRs")

if __name__ == '__main__':
    main()
