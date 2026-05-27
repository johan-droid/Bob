"""tests/test_scanner.py — PRHealthScanner unit tests with mocked GitHub API."""
import pytest
from unittest.mock import patch, MagicMock
try:
    from backend.pr_health_scanner import PRHealthScanner
except ImportError:
    from pr_health_scanner import PRHealthScanner


def make_resp(json_data, status=200, headers=None):
    m = MagicMock()
    m.status_code = status
    m.json.return_value = json_data
    m.headers = {'X-RateLimit-Remaining': '100', 'X-RateLimit-Reset': '0', **(headers or {})}
    return m


@pytest.fixture
def scanner():
    return PRHealthScanner('fake_token', ['org/repo'], assignee='jules')


def test_get_open_prs_returns_list(scanner):
    with patch('requests.Session.get', return_value=make_resp([{'number': 1, 'title': 'Fix bug', 'html_url': 'http://x'}])):
        prs = scanner.get_open_prs('org/repo')
    assert len(prs) == 1
    assert prs[0]['number'] == 1


def test_get_open_prs_returns_empty_on_error(scanner):
    with patch('requests.Session.get', return_value=make_resp({'error': 'x'}, 404)):
        prs = scanner.get_open_prs('org/repo')
    assert prs == []


def test_check_merge_conflict_detects_false(scanner):
    with patch('requests.Session.get', return_value=make_resp({'mergeable': False})):
        assert scanner.check_merge_conflict('org/repo', 1) is True


def test_check_merge_conflict_no_conflict(scanner):
    with patch('requests.Session.get', return_value=make_resp({'mergeable': True})):
        assert scanner.check_merge_conflict('org/repo', 1) is False


def test_check_merge_conflict_unknown(scanner):
    with patch('requests.Session.get', return_value=make_resp({'mergeable': None})):
        assert scanner.check_merge_conflict('org/repo', 1) is False


def test_issue_dedup_skips_existing(scanner):
    existing = [{'title': '🚨 Merge conflict in PR #1 already exists', 'state': 'open'}]
    with patch('requests.Session.get', return_value=make_resp(existing)):
        # Title prefix matches, should be skipped
        result = scanner.create_issue('org/repo', '🚨 Merge conflict in PR #1', 'body', ['needs-fix'])
    assert result.get('skipped') is True


def test_scan_workflow_failures_parses_runs(scanner):
    data = {'workflow_runs': [
        {'id': 99, 'name': 'CI', 'conclusion': 'failure',
         'head_branch': 'main', 'html_url': 'http://x', 'created_at': '2024-01-01'}
    ]}
    with patch('requests.Session.get', return_value=make_resp(data)):
        failures = scanner.scan_workflow_failures('org/repo')
    assert len(failures) == 1
    assert failures[0]['name'] == 'CI'


def test_rate_limit_sleep_triggered(scanner):
    """When X-RateLimit-Remaining < 10, sleep should be called."""
    resp = make_resp([{'number': 1, 'title': 'PR', 'html_url': 'x'}],
                     headers={'X-RateLimit-Remaining': '3', 'X-RateLimit-Reset': '0'})
    with patch('requests.Session.get', return_value=resp), patch('time.sleep') as mock_sleep:
        scanner.get_open_prs('org/repo')
    mock_sleep.assert_called()


def test_assignee_configurable():
    s = PRHealthScanner('tok', [], assignee='custom_user')
    assert s.assignee == 'custom_user'
