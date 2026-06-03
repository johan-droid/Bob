"""OAuth and security tests."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SESSION_TYPE", "filesystem")
os.environ.setdefault("WEBHOOK_SECRET", "")

import pytest

from api_server import app as flask_app, get_user_token


@pytest.fixture
def client():
    flask_app.config.update(
        {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )
    with flask_app.test_client() as c:
        yield c


def test_landing_redirects_to_dashboard_when_logged_in(client):
    with client.session_transaction() as s:
        s["user"] = {
            "id": 1,
            "db_id": 1,
            "username": "test",
            "avatar": "",
            "name": "Test",
            "email": "",
        }
    r = client.get("/")
    assert r.status_code == 302


def test_api_endpoints_require_auth(client):
    for path in ["/api/verify-permissions", "/api/repos", "/api/issues", "/api/settings"]:
        r = client.get(path)
        assert r.status_code == 401


def test_oauth_state_mismatch_rejected(client):
    with client.session_transaction() as s:
        s["oauth_state"] = "correct_state"
    r = client.get("/callback/github?code=abc&state=wrong_state")
    assert r.status_code == 302
    assert "invalid_state" in r.headers["Location"]


def test_csrf_token_endpoint(client):
    r = client.get("/api/csrf-token")
    assert r.status_code == 200
    data = r.get_json()
    assert "csrf_token" in data


def test_plaintext_token_is_invalidated_and_requires_reauth(client):
    from models import db, User

    with flask_app.app_context():
        user = User(username="legacy_token_user", github_id="1234567", access_token="ghp_plain")
        db.session.add(user)
        db.session.commit()
        user_id = user.id

        token = get_user_token(user_id)
        assert token is None

        refreshed = db.session.get(User, user_id)
        assert refreshed.access_token is None


def test_webhook_requires_secret_and_rejects_when_unconfigured(client, monkeypatch):
    import api_server

    monkeypatch.setattr(api_server, "WEBHOOK_SECRET", "")
    r = client.post("/api/webhooks/github", json={"repository": {"full_name": "org/repo"}})
    assert r.status_code == 503


def test_webhook_rejects_missing_signature_when_secret_configured(client, monkeypatch):
    import api_server

    monkeypatch.setattr(api_server, "WEBHOOK_SECRET", "testsecret")
    r = client.post("/api/webhooks/github", json={"repository": {"full_name": "org/repo"}})
    assert r.status_code == 403
