"""tests/test_auth.py — OAuth and security tests."""
import pytest
from api_server import app as flask_app

@pytest.fixture
def client():
    flask_app.config.update({'TESTING': True, 'WTF_CSRF_ENABLED': False,
                              'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:'})
    with flask_app.test_client() as c:
        yield c

def test_landing_redirects_to_dashboard_when_logged_in(client):
    with client.session_transaction() as s:
        s['user'] = {'id': 1, 'db_id': 1, 'username': 'test', 'avatar': '', 'name': 'Test', 'email': ''}
    r = client.get('/')
    assert r.status_code == 302
    assert '/dashboard' in r.headers['Location']

def test_landing_shows_landing_when_logged_out(client):
    r = client.get('/')
    assert r.status_code == 200

def test_dashboard_requires_auth(client):
    r = client.get('/dashboard')
    assert r.status_code == 302
    assert '/' in r.headers['Location']

def test_permissions_requires_auth(client):
    r = client.get('/permissions')
    assert r.status_code == 302

def test_api_endpoints_require_auth(client):
    for path in ['/api/verify-permissions', '/api/repos', '/api/issues', '/api/settings']:
        r = client.get(path)
        assert r.status_code == 401, f'{path} should return 401'

def test_oauth_state_mismatch_rejected(client):
    with client.session_transaction() as s:
        s['oauth_state'] = 'correct_state'
    r = client.get('/callback/github?code=abc&state=wrong_state')
    assert r.status_code == 302
    assert 'invalid_state' in r.headers['Location']

def test_csrf_token_endpoint(client):
    r = client.get('/api/csrf-token')
    assert r.status_code == 200
    data = r.get_json()
    assert 'csrf_token' in data
    assert len(data['csrf_token']) > 10

def test_health_check(client):
    r = client.get('/api/health')
    assert r.status_code == 200
    data = r.get_json()
    assert data['status'] == 'ok'
