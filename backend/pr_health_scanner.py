"""pr_health_scanner.py — with dedup, rate-limit awareness, configurable assignee."""
import os, time, requests
from typing import List, Dict, Any

GITHUB_API = "https://api.github.com"


class PRHealthScanner:
    def __init__(self, token: str, repos: List[str], assignee: str = 'jules'):
        self.token    = token
        self.repos    = repos
        self.assignee = assignee
        self.headers  = {
            'Authorization': f'token {token}',
            'Accept': 'application/vnd.github.v3+json',
        }

    def _get(self, url: str, params: dict = None, retries: int = 4) -> Any:
        for attempt in range(retries):
            try:
                r = requests.get(url, headers=self.headers, params=params, timeout=15)
                remaining = int(r.headers.get('X-RateLimit-Remaining', 999))
                if remaining < 10:
                    reset_at = int(r.headers.get('X-RateLimit-Reset', time.time() + 60))
                    wait = max(0, reset_at - time.time()) + 2
                    time.sleep(wait)
                if r.status_code == 200:
                    return r.json()
                if r.status_code in (403, 429):
                    time.sleep((attempt + 1) * 3)
                    continue
                return {'error': f'HTTP {r.status_code}'}
            except requests.RequestException as e:
                if attempt == retries - 1:
                    return {'error': str(e)}
                time.sleep(3)
        return {'error': 'Max retries exceeded'}

    def _post(self, url: str, json_data: dict) -> Any:
        try:
            r = requests.post(url, headers=self.headers, json=json_data, timeout=10)
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

    def scan_workflow_failures(self, repo: str) -> List[Dict]:
        result = self._get(f'{GITHUB_API}/repos/{repo}/actions/runs',
                           params={'status': 'failure', 'per_page': 10})
        if not isinstance(result, dict):
            return []
        return [
            {'id': r.get('id'), 'name': r.get('name'), 'conclusion': r.get('conclusion'),
             'branch': r.get('head_branch'), 'html_url': r.get('html_url'),
             'created_at': r.get('created_at')}
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

    def scan_repository(self, repo: str) -> Dict:
        results = {'repo': repo, 'conflicting_prs': [], 'workflow_failures': [], 'total_prs': 0}
        prs = self.get_open_prs(repo)
        results['total_prs'] = len(prs)
        for pr in prs:
            pr_num = pr.get('number')
            if self.check_merge_conflict(repo, pr_num):
                results['conflicting_prs'].append({
                    'pr': pr_num, 'title': pr.get('title'),
                    'url': pr.get('html_url'), 'head_branch': pr.get('head', {}).get('ref'),
                })
        results['workflow_failures'] = self.scan_workflow_failures(repo)
        return results

    def scan_all_repos(self) -> List[Dict]:
        all_results = []
        for repo in self.repos:
            print(f'Scanning {repo}…')
            result = self.scan_repository(repo)
            all_results.append(result)

            for cp in result['conflicting_prs']:
                title = f"🚨 Merge conflict in PR #{cp['pr']}"
                body  = (f"@{self.assignee} merge conflict detected.\n\n"
                         f"Branch `{cp['head_branch']}` conflicts with base.\n\nPR: {cp['url']}")
                self.create_issue(repo, title, body, ['needs-fix', 'merge-conflict'])
                self.add_label(repo, cp['pr'], 'needs-fix')

            for f in result['workflow_failures']:
                title = f"⚠️ Workflow '{f['name']}' failed on {f['branch']}"
                body  = f"@{self.assignee} please investigate: {f['html_url']}"
                self.create_issue(repo, title, body, ['needs-fix', 'ci-failure'])

        return all_results


def main():
    from dotenv import load_dotenv
    load_dotenv()
    token    = os.getenv('GITHUB_TOKEN')
    raw      = os.getenv('TARGET_REPOS', '')
    repos    = [r.strip() for r in raw.split(',') if r.strip()]
    assignee = os.getenv('ASSIGNEE_USERNAME', 'jules')
    if not token or not repos:
        print('Set GITHUB_TOKEN and TARGET_REPOS in .env')
        return
    scanner = PRHealthScanner(token, repos, assignee=assignee)
    results = scanner.scan_all_repos()
    for r in results:
        print(f"\n{r['repo']}: {r['total_prs']} PRs, "
              f"{len(r['conflicting_prs'])} conflicts, "
              f"{len(r['workflow_failures'])} CI failures")

if __name__ == '__main__':
    main()
