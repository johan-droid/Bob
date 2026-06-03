"""Merge readiness policy evaluation for Bob."""

from typing import Any, Dict, List


def _index_check_runs(check_runs: List[Dict[str, Any]]) -> Dict[str, str]:
    status_by_name: Dict[str, str] = {}
    for check in check_runs:
        name = check.get("name")
        if not name:
            continue
        if check.get("status") != "completed":
            status_by_name[name] = "in_progress"
            continue
        conclusion = (check.get("conclusion") or "").lower()
        if conclusion in {"success", "neutral", "skipped"}:
            status_by_name[name] = "success"
        else:
            status_by_name[name] = "failure"
    return status_by_name


def evaluate_merge_readiness(policy: Dict[str, Any], check_runs: List[Dict[str, Any]], approved_count: int) -> Dict[str, Any]:
    required_checks = policy.get("required_checks", [])
    required_approvals = int(policy.get("required_approvals", 1))

    indexed_checks = _index_check_runs(check_runs)

    missing_checks = [name for name in required_checks if name not in indexed_checks]
    failing_checks = [name for name in required_checks if indexed_checks.get(name) == "failure"]
    pending_checks = [name for name in required_checks if indexed_checks.get(name) == "in_progress"]

    approvals_ok = approved_count >= required_approvals
    checks_ok = not missing_checks and not failing_checks and not pending_checks

    ready = approvals_ok and checks_ok

    reasons: List[str] = []
    if missing_checks:
        reasons.append(f"Missing required checks: {', '.join(missing_checks)}")
    if failing_checks:
        reasons.append(f"Failing required checks: {', '.join(failing_checks)}")
    if pending_checks:
        reasons.append(f"Pending required checks: {', '.join(pending_checks)}")
    if not approvals_ok:
        reasons.append(
            f"Approvals insufficient: {approved_count}/{required_approvals}"
        )

    summary = "Merge ready" if ready else "Merge requirements not satisfied"

    return {
        "ready": ready,
        "summary": summary,
        "reasons": reasons,
        "required_checks": required_checks,
        "required_approvals": required_approvals,
        "approved_count": approved_count,
        "missing_checks": missing_checks,
        "failing_checks": failing_checks,
        "pending_checks": pending_checks,
    }
