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
        for attempt in range(retries):
            try:
                r = self.session.get(url, params=params, timeout=15)
                remaining = int(r.headers.get("X-RateLimit-Remaining", 999))
                if remaining < 10:
                    reset_at = int(r.headers.get("X-RateLimit-Reset", time.time() + 60))
                    wait = max(0, reset_at - time.time()) + 2
                    logger.warning("Rate limit low (%s), sleeping %.0fs", remaining, wait)
                    time.sleep(wait)
                if r.status_code == 200:
                    return r.json()
                if r.status_code in (403, 429):
                    time.sleep((attempt + 1) * 3)
                    continue
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
        pr = self.get_pr_detail(repo, pr_number)
        return isinstance(pr, dict) and pr.get("mergeable") is False

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

        prs = self.get_open_prs(repo)
        results["total_prs"] = len(prs)

        branch_to_pr: Dict[str, int] = {}
        for pr in prs:
            pr_num = pr.get("number")
            head = pr.get("head") or {}
            head_branch = head.get("ref")
            if head_branch:
                branch_to_pr[head_branch] = pr_num

            if self.check_merge_conflict(repo, pr_num):
                results["conflicting_prs"].append(
                    {
                        "pr": pr_num,
                        "title": pr.get("title"),
                        "url": pr.get("html_url"),
                        "head_branch": head_branch,
                        "author": (pr.get("user") or {}).get("login"),
                        "head_sha": (head or {}).get("sha"),
                    }
                )

            review_info = self.get_pr_reviews(repo, pr_num)
            if review_info.get("changes_requested_count", 0) > 0:
                results["review_issues"].append(
                    {
                        "pr": pr_num,
                        "title": pr.get("title"),
                        "url": pr.get("html_url"),
                        "head_branch": head_branch,
                        "author": (pr.get("user") or {}).get("login"),
                    }
                )

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
