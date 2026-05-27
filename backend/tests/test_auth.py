"""tests/test_auth.py — OAuth and security tests."""
import os

os.environ.setdefault('SECRET_KEY', 'test-secret-key')
os.environ.setdefault('DATABASE_URL', 'sqlite:///:memory:')
os.environ.setdefault('SESSION_TYPE', 'filesystem')
os.environ.setdefault('SCAN_INTERVAL', '999999')
os.environ.setdefault('WEBHOOK_SECRET', '')
os.environ.setdefault('ALLOW_UNSIGNED_WEBHOOKS', '0')

import pytest
from api_server import app as flask_app
from api_server import _encrypt_token

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

def test_webhook_requires_signature_when_secret_missing(client):
    r = client.post('/api/webhooks/github', json={'repository': {'full_name': 'acme/demo'}})
    assert r.status_code == 403

def test_health_check(client):
    r = client.get('/api/health')
    assert r.status_code == 200
    data = r.get_json()
    assert data['status'] == 'ok'

def test_delete_account_requires_auth(client):
    r = client.post('/api/account/delete')
    assert r.status_code == 401

def test_delete_account_success(client):
    from models import db, User
    with flask_app.app_context():
        # Create a test user in DB
        u = User(username='delete_me', github_id='999999')
        db.session.add(u)
        db.session.commit()
        user_id = u.id

    # Log in
    with client.session_transaction() as s:
        s['user'] = {
            'id': 999999,
            'db_id': user_id,
            'username': 'delete_me',
            'avatar': '',
            'name': 'Delete Me',
            'email': ''
        }

    # Perform deletion
    r = client.post('/api/account/delete')
    assert r.status_code == 200
    data = r.get_json()
    assert data['success'] is True

    # Verify session is cleared
    with client.session_transaction() as s:
        assert 'user' not in s

    # Verify user is deleted from DB
    with flask_app.app_context():
        u_db = db.session.get(User, user_id)
        assert u_db is None


def test_github_token_is_encrypted_at_rest(client):
    from models import db, User

    with flask_app.app_context():
        user = User(username='token_user', github_id=424242, access_token=_encrypt_token('plain-token'))
        db.session.add(user)
        db.session.commit()
        user_id = user.id

        stored = db.session.get(User, user_id)
        assert stored is not None
        assert stored.access_token != 'plain-token'

        from api_server import get_user_token
        assert get_user_token(user_id) == 'plain-token'

