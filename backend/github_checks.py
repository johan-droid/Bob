"""GitHub Checks API publishing helpers."""

from typing import Any, Dict


def publish_merge_readiness_check(scanner, repo_full_name: str, head_sha: str, evaluation: Dict[str, Any], details_url: str = "") -> Dict[str, Any]:
    if not head_sha:
        return {"error": "Missing head_sha"}

    if evaluation.get("ready"):
        conclusion = "success"
    elif evaluation.get("pending_checks"):
        conclusion = "neutral"
    else:
        conclusion = "failure"

    payload = {
        "name": "bob/merge-readiness",
        "head_sha": head_sha,
        "status": "completed",
        "conclusion": conclusion,
        "output": {
            "title": evaluation.get("summary", "Merge readiness"),
            "summary": "\n".join(evaluation.get("reasons") or ["All policy requirements passed"]),
        },
    }

    if details_url:
        payload["details_url"] = details_url

    return scanner._post(f"https://api.github.com/repos/{repo_full_name}/check-runs", payload)  # noqa: SLF001
