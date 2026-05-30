from policy_engine import evaluate_merge_readiness


def test_merge_ready_when_checks_and_approvals_satisfy_policy():
    policy = {"required_checks": ["ci/test", "ci/lint"], "required_approvals": 2}
    check_runs = [
        {"name": "ci/test", "status": "completed", "conclusion": "success"},
        {"name": "ci/lint", "status": "completed", "conclusion": "success"},
    ]
    result = evaluate_merge_readiness(policy, check_runs, approved_count=2)
    assert result["ready"] is True


def test_merge_not_ready_when_required_check_fails():
    policy = {"required_checks": ["ci/test"], "required_approvals": 1}
    check_runs = [{"name": "ci/test", "status": "completed", "conclusion": "failure"}]
    result = evaluate_merge_readiness(policy, check_runs, approved_count=2)
    assert result["ready"] is False
    assert "ci/test" in result["failing_checks"]


def test_merge_not_ready_when_approvals_missing():
    policy = {"required_checks": [], "required_approvals": 2}
    result = evaluate_merge_readiness(policy, [], approved_count=1)
    assert result["ready"] is False
    assert result["required_approvals"] == 2
