from repo_config import validate_bob_config


def test_validate_bob_config_accepts_valid_policy():
    policy, errors = validate_bob_config(
        {
            "policy": {
                "required_checks": ["ci/test", "ci/lint"],
                "required_approvals": 2,
                "stale_hours": 48,
            }
        }
    )
    assert not errors
    assert policy["required_approvals"] == 2
    assert policy["required_checks"] == ["ci/test", "ci/lint"]


def test_validate_bob_config_reports_invalid_fields():
    policy, errors = validate_bob_config(
        {"policy": {"required_checks": "ci/test", "required_approvals": -1, "stale_hours": 0}}
    )
    assert errors
    assert policy["required_approvals"] == 1
