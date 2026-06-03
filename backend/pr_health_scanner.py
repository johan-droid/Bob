"""PR health scanner and GitHub API helpers for Bob."""

import os
import time
from typing import Any, Dict, List

import requests

try:
    from .logger import get_logger
except ImportError:
    from logger import get_logger

logger = get_logger(__name__)
GITHUB_API = "https://api.github.com"


class PRHealthScanner:
    STATUS_COMMENT_MARKER = "<!-- bob-pr-health -->"

    def __init__(
        self,
        token: str,
        repos: List[str],
        assignee: str = "jules",
        auto_label_conflict: bool = True,
        tag_author_on_fail: bool = False,
    ):
        self.token = token
        self.repos = repos
        self.assignee = assignee
        self.auto_label_conflict = auto_label_conflict
        self.tag_author_on_fail = tag_author_on_fail
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            }
        )

    def _get(self, url: str, params: dict = None, retries: int = 4) -> Any:
        # Introduce an intentional micro-delay (e.g., 200ms) between outbound requests
        # to stop the Free Tier API from triggering secondary abuse limits.
        time.sleep(0.2)
        
        for attempt in range(retries):
            try:
                r = self.session.get(url, params=params, timeout=15)
                
                # Read exact GitHub rate limiting metrics
                remaining = r.headers.get("X-RateLimit-Remaining")
                reset_time = r.headers.get("X-RateLimit-Reset")
                
                if r.status_code == 403 or r.status_code == 429:
                    if reset_time:
                        wait = max(1, int(reset_time) - int(time.time())) + 5
                        logger.warning(f"Rate limited by GitHub. Cool down required: sleeping {wait}s")
                        time.sleep(wait)
                        continue
                    else:
                        time.sleep((attempt + 1) * 5)
                        continue
                        
                if r.status_code == 200:
                    return r.json()
                    
                return {"error": f"HTTP {r.status_code}", "status_code": r.status_code}
            except requests.RequestException as e:
                if attempt == retries - 1:
                    return {"error": str(e)}
                time.sleep(3)
        return {"error": "Max retries exceeded"}

    def _post(self, url: str, json_data: dict) -> Any:
        try:
            r = self.session.post(url, json=json_data, timeout=12)
            if r.status_code in (200, 201):
                return r.json()
            if r.status_code == 204:
                return {"success": True}
            return {"error": f"HTTP {r.status_code}", "status_code": r.status_code, "body": r.text}
        except requests.RequestException as e:
            return {"error": str(e)}

    def _patch(self, url: str, json_data: dict) -> Any:
        try:
            r = self.session.patch(url, json=json_data, timeout=12)
            if r.status_code in (200, 201):
                return r.json()
            return {"error": f"HTTP {r.status_code}", "status_code": r.status_code, "body": r.text}
        except requests.RequestException as e:
            return {"error": str(e)}

    def get_open_prs(self, repo: str) -> List[Dict[str, Any]]:
        result = self._get(
            f"{GITHUB_API}/repos/{repo}/pulls",
            params={"state": "open", "per_page": 100},
        )
        return result if isinstance(result, list) else []

    def get_pr_detail(self, repo: str, pr_number: int) -> Dict[str, Any]:
        result = self._get(f"{GITHUB_API}/repos/{repo}/pulls/{pr_number}")
        return result if isinstance(result, dict) else {}

    def get_pr_reviews(self, repo: str, pr_number: int) -> Dict[str, Any]:
        result = self._get(f"{GITHUB_API}/repos/{repo}/pulls/{pr_number}/reviews")
        if not isinstance(result, list):
            return {"approved_count": 0, "changes_requested_count": 0, "reviewers": []}

        latest_by_reviewer: Dict[str, str] = {}
        for review in result:
            reviewer = (review.get("user") or {}).get("login")
            state = (review.get("state") or "").upper()
            if reviewer and state in {"APPROVED", "CHANGES_REQUESTED", "DISMISSED", "COMMENTED"}:
                latest_by_reviewer[reviewer] = state

        approved_count = sum(1 for state in latest_by_reviewer.values() if state == "APPROVED")
        changes_requested_count = sum(
            1 for state in latest_by_reviewer.values() if state == "CHANGES_REQUESTED"
        )

        return {
            "approved_count": approved_count,
            "changes_requested_count": changes_requested_count,
            "reviewers": [{"reviewer": k, "state": v} for k, v in latest_by_reviewer.items()],
        }

    def get_check_runs_for_ref(self, repo: str, ref: str) -> List[Dict[str, Any]]:
        result = self._get(
            f"{GITHUB_API}/repos/{repo}/commits/{ref}/check-runs",
            params={"per_page": 100},
        )
        if isinstance(result, dict):
            return result.get("check_runs", []) or []
        return []

    def check_merge_conflict(self, repo: str, pr_number: int) -> bool:
        """Check if a PR has a merge conflict, with retry logic for async mergeable status.
        
        GitHub calculates mergeable status asynchronously. When a PR is modified,
        the mergeable field may return None initially. This method polls up to 3 times
        with 2-second delays until it gets an explicit True or False value.
        """
        max_retries = 3
        retry_delay = 2
        
        for attempt in range(max_retries):
            pr = self.get_pr_detail(repo, pr_number)
            if not isinstance(pr, dict):
                return False
            
            mergeable = pr.get("mergeable")
            
            # If we have an explicit boolean value, return it immediately
            if mergeable is True:
                return False  # mergeable=True means no conflict
            if mergeable is False:
                return True   # mergeable=False means there IS a conflict
            
            # mergeable is None - GitHub is still calculating, wait and retry
            if attempt < max_retries - 1:
                logger.debug(
                    f"PR #{pr_number} mergeable status is None (async calculation), "
                    f"retry {attempt + 1}/{max_retries} after {retry_delay}s"
                )
                time.sleep(retry_delay)
        
        # After all retries, if still None, treat as no conflict (conservative default)
        logger.warning(
            f"PR #{pr_number} mergeable status remained None after {max_retries} attempts, "
            f"assuming no conflict"
        )
        return False

    def scan_workflow_failures(self, repo: str) -> List[Dict[str, Any]]:
        result = self._get(
            f"{GITHUB_API}/repos/{repo}/actions/runs",
            params={"status": "failure", "per_page": 20},
        )
        if not isinstance(result, dict):
            return []
        return [
            {
                "id": run.get("id"),
                "name": run.get("name"),
                "conclusion": run.get("conclusion"),
                "branch": run.get("head_branch"),
                "html_url": run.get("html_url"),
                "created_at": run.get("created_at"),
                "author": (run.get("triggering_actor") or {}).get("login") or "github-actions",
            }
            for run in result.get("workflow_runs", [])
        ]

    def create_comment(self, repo: str, pr_number: int, body: str) -> Dict[str, Any]:
        return self._post(f"{GITHUB_API}/repos/{repo}/issues/{pr_number}/comments", {"body": body})

    def update_comment(self, repo: str, comment_id: int, body: str) -> Dict[str, Any]:
        return self._patch(
            f"{GITHUB_API}/repos/{repo}/issues/comments/{comment_id}",
            {"body": body},
        )

    def upsert_status_comment(self, repo: str, pr_number: int, body: str) -> Dict[str, Any]:
        marker_body = f"{self.STATUS_COMMENT_MARKER}\n{body}"
        comments = self._get(
            f"{GITHUB_API}/repos/{repo}/issues/{pr_number}/comments",
            params={"per_page": 100},
        )
        if isinstance(comments, list):
            for comment in comments:
                existing = comment.get("body") or ""
                if self.STATUS_COMMENT_MARKER in existing:
                    comment_id = comment.get("id")
                    if existing.strip() == marker_body.strip():
                        return {"unchanged": True, "id": comment_id}
                    return self.update_comment(repo, comment_id, marker_body)
        return self.create_comment(repo, pr_number, marker_body)

    def rerun_workflow(self, repo: str, run_id: int) -> Dict[str, Any]:
        try:
            r = self.session.post(
                f"{GITHUB_API}/repos/{repo}/actions/runs/{run_id}/rerun-failed-jobs",
                timeout=12,
            )
            if r.status_code in (201, 204):
                return {"success": True}
            return {"error": f"HTTP {r.status_code}", "body": r.text}
        except requests.RequestException as e:
            return {"error": str(e)}

    def request_review(self, repo: str, pr_number: int, reviewers: List[str]) -> Dict[str, Any]:
        return self._post(
            f"{GITHUB_API}/repos/{repo}/pulls/{pr_number}/requested_reviewers",
            {"reviewers": reviewers},
        )

    def batch_scan_graphql(self, owner: str, repo_name: str) -> Dict[str, Any]:
        """
        Batches pull requests, mergeable states, conflict flags, and review summaries
        using a single GraphQL token request instead of dozens of REST calls.
        """
        url = "https://api.github.com/graphql"
        query = """
        query($owner: String!, $name: String!) {
          repository(owner: $owner, name: $name) {
            pullRequests(states: OPEN, first: 50) {
              nodes {
                number
                title
                url
                mergeable
                author { login }
                headRef { name target { oid } }
                reviews(last: 10) {
                  nodes {
                    state
                    author { login }
                  }
                }
              }
            }
          }
        }
        """
        
        headers = {
            "Authorization": f"bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.post(url, json={"query": query, "variables": {"owner": owner, "name": repo_name}}, headers=headers, timeout=15)
            if response.status_code != 200:
                return {"error": f"GraphQL Error {response.status_code}"}
                
            data = response.json()
            if "errors" in data:
                return {"error": data["errors"][0]["message"]}
                
            # Parse output safely directly into Bob's internal scan schema
            return data.get("data", {}).get("repository", {})
        except Exception as e:
            return {"error": str(e)}

    def scan_repository(self, repo: str) -> Dict[str, Any]:
        results = {
            "repo": repo,
            "conflicting_prs": [],
            "workflow_failures": [],
            "review_issues": [],
            "stale_prs": [],
            "oversized_prs": [],
            "total_prs": 0,
            "healthy_prs": 0,
        }

        # Parse repo into owner/name for GraphQL
        parts = repo.split("/")
        if len(parts) != 2:
            logger.error(f"Invalid repo format: {repo}. Expected 'owner/name'")
            return results
        
        owner, repo_name = parts
        
        # Use GraphQL batch query instead of individual REST calls
        graphql_result = self.batch_scan_graphql(owner, repo_name)
        
        if "error" in graphql_result:
            logger.error(f"GraphQL scan failed for {repo}: {graphql_result['error']}")
            return results
        
        pull_requests = graphql_result.get("pullRequests", {}).get("nodes", [])
        results["total_prs"] = len(pull_requests)

        branch_to_pr: Dict[str, int] = {}
        for pr_node in pull_requests:
            pr_num = pr_node.get("number")
            head_ref = pr_node.get("headRef") or {}
            head_branch = head_ref.get("name")
            if head_branch:
                branch_to_pr[head_branch] = pr_num

            # Check mergeable status from GraphQL (already includes async resolution)
            mergeable = pr_node.get("mergeable")
            if mergeable == "CONFLICTING":
                results["conflicting_prs"].append(
                    {
                        "pr": pr_num,
                        "title": pr_node.get("title"),
                        "url": pr_node.get("url"),
                        "head_branch": head_branch,
                        "author": (pr_node.get("author") or {}).get("login"),
                        "head_sha": (head_ref.get("target") or {}).get("oid"),
                    }
                )

            # Process reviews from GraphQL response
            reviews = pr_node.get("reviews", {}).get("nodes", [])
            changes_requested = sum(1 for r in reviews if r.get("state") == "CHANGES_REQUESTED")
            if changes_requested > 0:
                results["review_issues"].append(
                    {
                        "pr": pr_num,
                        "title": pr_node.get("title"),
                        "url": pr_node.get("url"),
                        "head_branch": head_branch,
                        "author": (pr_node.get("author") or {}).get("login"),
                    }
                )

        # Still need REST for workflow failures (not available in current GraphQL query)
        failures = self.scan_workflow_failures(repo)
        for failure in failures:
            failure["pr"] = branch_to_pr.get(failure.get("branch"))
        results["workflow_failures"] = failures

        return results

    def scan_all_repos(self) -> List[Dict[str, Any]]:
        all_results = []
        for repo in self.repos:
            logger.info("Scanning %s...", repo)
            all_results.append(self.scan_repository(repo))
        return all_results


def main():
    from dotenv import load_dotenv

    load_dotenv()
    token = os.getenv("GITHUB_TOKEN")
    raw = os.getenv("TARGET_REPOS", "")
    repos = [repo.strip() for repo in raw.split(",") if repo.strip()]
    assignee = os.getenv("ASSIGNEE_USERNAME", "jules")

    if not token or not repos:
        print("Set GITHUB_TOKEN and TARGET_REPOS in .env")
        return

    scanner = PRHealthScanner(token, repos, assignee=assignee)
    results = scanner.scan_all_repos()
    for result in results:
        print(
            f"{result['repo']}: {result['total_prs']} PRs, "
            f"{len(result['conflicting_prs'])} conflicts, "
            f"{len(result['workflow_failures'])} CI failures"
        )


if __name__ == "__main__":
    main()
