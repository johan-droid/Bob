import requests
import time
from typing import List, Dict, Any

GITHUB_API = "https://api.github.com"

class PRHealthScanner:
    def __init__(self, token: str, repos: List[str]):
        self.token = token
        self.repos = repos
        self.headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json"
        }
    
    def _make_request(self, url: str, retries: int = 5, wait_ms: int = 3000) -> Dict[str, Any]:
        """Make GitHub API request with retry logic."""
        for attempt in range(retries):
            try:
                response = requests.get(url, headers=self.headers)
                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 403:
                    # Rate limited - wait and retry
                    time.sleep((attempt + 1) * (wait_ms / 1000))
                else:
                    return {"error": f"HTTP {response.status_code}"}
            except requests.exceptions.RequestException as e:
                if attempt == retries - 1:
                    return {"error": str(e)}
                time.sleep(wait_ms / 1000)
        return {"error": "Max retries exceeded"}
    
    def get_open_prs(self, repo: str) -> List[Dict[str, Any]]:
        """Fetch all open PRs for a repository."""
        url = f"{GITHUB_API}/repos/{repo}/pulls?state=open&per_page=100"
        return self._make_request(url)
    
    def check_merge_conflict(self, repo: str, pr_number: int) -> bool:
        """Check if PR has merge conflicts using mergeable status."""
        url = f"{GITHUB_API}/repos/{repo}/pulls/{pr_number}"
        pr = self._make_request(url)
        
        if "error" in pr:
            return False
        
        # mergeable can be 'true', 'false', or 'unknown' (computing)
        mergeable = pr.get("mergeable")
        return mergeable == "false"
    
    def scan_workflow_failures(self, repo: str) -> List[Dict[str, Any]]:
        """Fetch latest workflow runs and flag failures."""
        url = f"{GITHUB_API}/repos/{repo}/actions/runs?status=failure&per_page=10"
        result = self._make_request(url)
        
        if "error" in result:
            return []
        
        runs = result.get("workflow_runs", [])
        failures = []
        
        for run in runs:
            failures.append({
                "id": run.get("id"),
                "name": run.get("name"),
                "conclusion": run.get("conclusion"),
                "branch": run.get("head_branch"),
                "html_url": run.get("html_url"),
                "created_at": run.get("created_at")
            })
        
        return failures
    
    def get_pr_mergeable_status(self, repo: str, pr_number: int) -> Dict[str, Any]:
        """Get detailed mergeable status for a PR."""
        url = f"{GITHUB_API}/repos/{repo}/pulls/{pr_number}"
        return self._make_request(url)
    
    def create_issue(self, repo: str, title: str, body: str, labels: List[str]) -> Dict[str, Any]:
        """Create an issue in the repository."""
        url = f"{GITHUB_API}/repos/{repo}/issues"
        response = requests.post(
            url,
            headers=self.headers,
            json={
                "title": title,
                "body": body,
                "labels": labels
            }
        )
        return response.json()
    
    def create_comment(self, repo: str, pr_number: int, body: str) -> Dict[str, Any]:
        """Create a comment on a PR."""
        url = f"{GITHUB_API}/repos/{repo}/issues/{pr_number}/comments"
        response = requests.post(
            url,
            headers=self.headers,
            json={"body": body}
        )
        return response.json()
    
    def add_label(self, repo: str, pr_number: int, label: str) -> Dict[str, Any]:
        """Add a label to a PR."""
        url = f"{GITHUB_API}/repos/{repo}/issues/{pr_number}/labels"
        response = requests.post(
            url,
            headers=self.headers,
            json={"labels": [label]}
        )
        return response.json()
    
    def scan_repository(self, repo: str) -> Dict[str, Any]:
        """Run full health scan on a single repository."""
        results = {
            "repo": repo,
            "conflicting_prs": [],
            "workflow_failures": [],
            "total_prs": 0
        }
        
        # Get all open PRs
        prs = self.get_open_prs(repo)
        if "error" in prs:
            results["error"] = prs["error"]
            return results
        
        results["total_prs"] = len(prs)
        
        # Check each PR for conflicts
        for pr in prs:
            pr_number = pr.get("number")
            if self.check_merge_conflict(repo, pr_number):
                results["conflicting_prs"].append({
                    "pr": pr_number,
                    "title": pr.get("title"),
                    "url": pr.get("html_url"),
                    "head_branch": pr.get("head", {}).get("ref")
                })
        
        # Check workflow failures
        results["workflow_failures"] = self.scan_workflow_failures(repo)
        
        return results
    
    def scan_all_repos(self) -> List[Dict[str, Any]]:
        """Run health scan on all configured repositories."""
        all_results = []
        
        for repo in self.repos:
            print(f"Scanning {repo}...")
            results = self.scan_repository(repo)
            all_results.append(results)
            
            # Process issues for failed PRs
            for conflicting_pr in results["conflicting_prs"]:
                issue_title = f"🚨 Merge conflict in PR #{conflicting_pr['pr']}"
                issue_body = f"@jules-google-lab merge conflict detected.\n\nBranch `{conflicting_pr['head_branch']}` conflicts with base.\n\nPR: {conflicting_pr['url']}"
                
                self.create_issue(
                    repo,
                    issue_title,
                    issue_body,
                    ["needs-fix", "merge-conflict"]
                )
                
                self.add_label(repo, conflicting_pr['pr'], "needs-fix")
            
            # Process workflow failures
            for failure in results["workflow_failures"]:
                issue_title = f"⚠️ Workflow '{failure['name']}' failed on {failure['branch']}"
                issue_body = f"@jules-google-lab please investigate: {failure['html_url']}"
                
                self.create_issue(
                    repo,
                    issue_title,
                    issue_body,
                    ["needs-fix", "ci-failure"]
                )
        
        return all_results


def main():
    """Main entry point for the scanner."""
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    token = os.getenv("GITHUB_TOKEN")
    repos = os.getenv("TARGET_REPOS", "org/repo-alpha,org/repo-beta,org/repo-gamma").split(",")
    
    if not token:
        print("Error: GITHUB_TOKEN not set")
        return
    
    scanner = PRHealthScanner(token, repos)
    results = scanner.scan_all_repos()
    
    # Print summary
    print("\n" + "=" * 60)
    print("SCAN SUMMARY")
    print("=" * 60)
    
    for result in results:
        repo = result["repo"]
        print(f"\n{repo}:")
        print(f"  Total PRs: {result.get('total_prs', 0)}")
        print(f"  Conflicting PRs: {len(result.get('conflicting_prs', []))}")
        print(f"  Workflow Failures: {len(result.get('workflow_failures', []))}")
        
        if "error" in result:
            print(f"  Error: {result['error']}")


if __name__ == "__main__":
    main()
