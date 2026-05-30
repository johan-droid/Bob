"""Repository-level Bob configuration loader and schema validation."""

import base64
from typing import Any, Dict, List, Tuple

import yaml


def default_policy() -> Dict[str, Any]:
    return {
        "required_checks": [],
        "required_approvals": 1,
        "stale_hours": 24,
    }


def validate_bob_config(data: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    errors: List[str] = []
    policy = default_policy()

    if not isinstance(data, dict):
        return policy, ["Configuration must be a YAML object"]

    raw_policy = data.get("policy", data)
    if not isinstance(raw_policy, dict):
        return policy, ["policy must be an object"]

    checks = raw_policy.get("required_checks", [])
    if checks is None:
        checks = []
    if not isinstance(checks, list) or not all(isinstance(x, str) and x.strip() for x in checks):
        errors.append("required_checks must be a list of non-empty strings")
    else:
        policy["required_checks"] = [x.strip() for x in checks]

    approvals = raw_policy.get("required_approvals", 1)
    if not isinstance(approvals, int) or approvals < 0:
        errors.append("required_approvals must be a non-negative integer")
    else:
        policy["required_approvals"] = approvals

    stale_hours = raw_policy.get("stale_hours", 24)
    if not isinstance(stale_hours, int) or stale_hours < 1:
        errors.append("stale_hours must be a positive integer")
    else:
        policy["stale_hours"] = stale_hours

    return policy, errors


def load_repo_bob_config(scanner, repo_full_name: str, ref: str = None) -> Dict[str, Any]:
    """Load and validate .bob.yml from GitHub repository via contents API."""
    path = f"https://api.github.com/repos/{repo_full_name}/contents/.bob.yml"
    params = {"ref": ref} if ref else None

    response = scanner._get(path, params=params)  # noqa: SLF001
    if isinstance(response, dict) and response.get("error"):
        return {
            "policy": default_policy(),
            "errors": [],
            "source": "default",
            "found": False,
        }

    if not isinstance(response, dict) or response.get("type") != "file":
        return {
            "policy": default_policy(),
            "errors": [],
            "source": "default",
            "found": False,
        }

    content = response.get("content", "")
    try:
        decoded = base64.b64decode(content).decode("utf-8")
        parsed = yaml.safe_load(decoded) if decoded.strip() else {}
    except Exception as exc:  # noqa: BLE001
        return {
            "policy": default_policy(),
            "errors": [f"Invalid .bob.yml: {exc}"],
            "source": ".bob.yml",
            "found": True,
        }

    policy, errors = validate_bob_config(parsed or {})
    return {
        "policy": policy,
        "errors": errors,
        "source": ".bob.yml",
        "found": True,
    }
