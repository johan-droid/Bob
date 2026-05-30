import sys as _sys
<<<<<<< Updated upstream
import os


def _eventlet_runtime_requested():
    cmdline = ' '.join(_sys.argv).lower()
    gunicorn_args = os.getenv('GUNICORN_CMD_ARGS', '').lower()
    socketio_mode = os.getenv('SOCKETIO_ASYNC_MODE', '').strip().lower()
    return (
        '--worker-class eventlet' in cmdline
        or '-k eventlet' in cmdline
        or 'worker-class eventlet' in gunicorn_args
        or 'worker_class=eventlet' in gunicorn_args
        or socketio_mode == 'eventlet'
    )


if _eventlet_runtime_requested():
    import eventlet
    eventlet.monkey_patch()

import json

def _resolve_async_mode():
    """Choose a Socket.IO async backend without late monkey-patching."""
    if _eventlet_runtime_requested():
        return 'eventlet'
    requested = os.getenv('SOCKETIO_ASYNC_MODE', 'threading').strip().lower()
    if requested == 'eventlet':
        try:
            import eventlet  # noqa: F401
        except ImportError:
            return 'threading'
    return requested or 'threading'


_ASYNC_MODE = _resolve_async_mode()

import base64
import secrets, hmac, hashlib, threading, time
from datetime import datetime
from functools import wraps
from urllib.parse import urlencode
from urllib import error as urllib_error, request as urllib_request
=======
import os, secrets, hmac, hashlib, time
from datetime import datetime
from functools import wraps
from urllib.parse import urlencode
from cryptography.fernet import Fernet, InvalidToken
>>>>>>> Stashed changes

from werkzeug.middleware.proxy_fix import ProxyFix
from flask import Flask, jsonify, request, render_template, redirect, session, abort, url_for, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room
from flask_session import Session
from flask_wtf.csrf import CSRFProtect, generate_csrf
from dotenv import load_dotenv
from cryptography.fernet import Fernet, InvalidToken

<<<<<<< Updated upstream
try:
    from .database import init_db
    from .models import db, User, UserRepo, PRIssue, UserSettings
    from .logger import get_logger
    from .pr_health_scanner import PRHealthScanner
    from .notifications import dispatch_notifications
except ImportError:
    from database import init_db
    from models import db, User, UserRepo, PRIssue, UserSettings
    from logger import get_logger
    from pr_health_scanner import PRHealthScanner
    from notifications import dispatch_notifications
=======
from database import init_db
from models import db, User, UserRepo, PRIssue, UserSettings
from logger import get_logger
from pr_health_scanner import PRHealthScanner
from job_queue import enqueue_background_job, queue_is_configured
>>>>>>> Stashed changes

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FRONTEND_DIR = os.path.join(PROJECT_ROOT, 'frontend')
REACT_DIST_DIR = os.path.join(PROJECT_ROOT, 'out')

# Load root .env explicitly if it exists to avoid missing credentials when run from backend/
_root_env = os.path.join(PROJECT_ROOT, '.env')
if os.path.exists(_root_env):
    load_dotenv(_root_env)
else:
    load_dotenv()
logger = get_logger(__name__)
logger.info(f"Socket.IO async mode selected: {_ASYNC_MODE}")

# ── Required env vars ─────────────────────────────────────────────────────────
SECRET_KEY = os.getenv('SECRET_KEY')
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is required. Run: python -c \"import secrets; print(secrets.token_hex(32))\"")

GITHUB_CLIENT_ID      = os.getenv('GITHUB_CLIENT_ID')
GITHUB_CLIENT_SECRET  = os.getenv('GITHUB_CLIENT_SECRET')
GITHUB_TOKEN          = os.getenv('GITHUB_TOKEN')
WEBHOOK_SECRET        = os.getenv('WEBHOOK_SECRET', '')
<<<<<<< Updated upstream
ALLOW_UNSIGNED_WEBHOOKS = os.getenv('ALLOW_UNSIGNED_WEBHOOKS', '0') == '1'
ALLOW_LEGACY_PLAINTEXT_TOKENS = os.getenv('ALLOW_LEGACY_PLAINTEXT_TOKENS', '0') == '1'
=======
TOKEN_ENCRYPTION_KEY  = os.getenv('TOKEN_ENCRYPTION_KEY', '')
>>>>>>> Stashed changes
ASSIGNEE_USERNAME     = os.getenv('ASSIGNEE_USERNAME', 'jules')
STALE_RESYNC_HOURS     = int(os.getenv('STALE_RESYNC_HOURS', 24))
FALLBACK_REPO_LIMIT    = int(os.getenv('FALLBACK_REPO_LIMIT', 25))
INTERNAL_CRON_TOKEN    = os.getenv('INTERNAL_CRON_TOKEN', '')
TARGET_REPOS_OVERRIDE = [r.strip() for r in os.getenv('TARGET_REPOS', '').split(',') if r.strip()]
ALLOWED_ORIGINS       = [o.strip() for o in os.getenv('ALLOWED_ORIGINS', 'http://localhost:5000,http://localhost:3000').split(',')]
PUBLIC_BASE_URL       = os.getenv('PUBLIC_BASE_URL', '').rstrip('/')
APP_ENV               = (os.getenv('FLASK_ENV') or os.getenv('APP_ENV') or os.getenv('ENV') or os.getenv('ENVIRONMENT') or '').lower()
IS_PRODUCTION         = APP_ENV == 'production' or os.getenv('RENDER') == 'true' or bool(os.getenv('RENDER_EXTERNAL_URL'))

if IS_PRODUCTION and ALLOW_UNSIGNED_WEBHOOKS:
    raise RuntimeError("ALLOW_UNSIGNED_WEBHOOKS must not be enabled in production")

if not TOKEN_ENCRYPTION_KEY:
    TOKEN_ENCRYPTION_KEY = Fernet.generate_key().decode()
    logger.warning('TOKEN_ENCRYPTION_KEY is not configured. Using ephemeral key; users must re-authenticate after restart.')

if not WEBHOOK_SECRET:
    logger.warning('WEBHOOK_SECRET is not configured. GitHub webhook endpoint will reject all requests.')

fernet = Fernet(TOKEN_ENCRYPTION_KEY)

SESSION_DIR  = os.getenv('SESSION_DIR', os.path.join(os.path.dirname(__file__), 'flask_sessions'))
os.makedirs(SESSION_DIR, exist_ok=True)

DATABASE_URL = os.getenv('DATABASE_URL', f'sqlite:///{os.path.join(os.path.dirname(__file__), "bob.db")}')
DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

# ── App setup ─────────────────────────────────────────────────────────────────
app = Flask(__name__, static_folder=None, template_folder=FRONTEND_DIR)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
app.secret_key = SECRET_KEY
app.config.update(
    SESSION_TYPE=os.getenv('SESSION_TYPE', 'filesystem'),
    SESSION_SQLALCHEMY=db,
    SESSION_FILE_DIR=SESSION_DIR,
    SESSION_PERMANENT=False,
    SESSION_USE_SIGNER=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=IS_PRODUCTION,
    WTF_CSRF_TIME_LIMIT=None,
    SQLALCHEMY_DATABASE_URI=DATABASE_URL,
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
    SQLALCHEMY_ENGINE_OPTIONS={
        "pool_pre_ping": True,
        "pool_recycle": 280,
    },
)

CORS(app, origins=ALLOWED_ORIGINS, supports_credentials=True)
Session(app)
csrf = CSRFProtect(app)
socketio = SocketIO(app,
                    cors_allowed_origins=ALLOWED_ORIGINS,
                    manage_session=False,
                    ping_timeout=30,
                    ping_interval=10,
                    async_mode=_ASYNC_MODE)
init_db(app)


@app.after_request
def add_no_cache_headers(response):
    """Prevent HTML documents from being cached across deploys."""
    if response.mimetype == 'text/html':
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

def ensure_schema():
    """Manually add columns if they don't exist (since create_all doesn't migrate)."""
    with app.app_context():
        try:
            from sqlalchemy import inspect, text

            migrations = {
                'users': [
                    ('access_token', "ALTER TABLE users ADD COLUMN access_token VARCHAR(255)"),
                ],
                'user_repos': [
                    ('agent_permission', "ALTER TABLE user_repos ADD COLUMN agent_permission VARCHAR(50) DEFAULT 'none'"),
                ],
                'pr_issues': [
                    ('last_commented_at', "ALTER TABLE pr_issues ADD COLUMN last_commented_at TIMESTAMP"),
                    ('comment_count', "ALTER TABLE pr_issues ADD COLUMN comment_count INTEGER DEFAULT 0"),
                    ('author', "ALTER TABLE pr_issues ADD COLUMN author VARCHAR(255)"),
                ],
                'user_settings': [
                    ('slack_webhook', "ALTER TABLE user_settings ADD COLUMN slack_webhook VARCHAR(500)"),
                    ('discord_webhook', "ALTER TABLE user_settings ADD COLUMN discord_webhook VARCHAR(500)"),
                    ('auto_label_conflict', "ALTER TABLE user_settings ADD COLUMN auto_label_conflict BOOLEAN DEFAULT TRUE"),
                    ('tag_author_on_fail', "ALTER TABLE user_settings ADD COLUMN tag_author_on_fail BOOLEAN DEFAULT FALSE"),
                ],
            }

            with db.engine.begin() as connection:
                inspector = inspect(connection)
                for table_name, table_migrations in migrations.items():
                    existing_columns = {col['name'] for col in inspector.get_columns(table_name)}
                    for column_name, sql in table_migrations:
                        if column_name not in existing_columns:
                            connection.execute(text(sql))
                            existing_columns.add(column_name)

            logger.info("Database schema check: OK (Auto-repaired if needed)")
        except Exception as e:
            logger.error(f"Schema auto-repair failed: {e}")
        finally:
            db.session.remove()

ensure_schema()

<<<<<<< Updated upstream
def _start_bg_scan():
    while True:
        try:
            background_scan()
            break
        except NameError:
            time.sleep(1)


_background_workers_started = False
_background_workers_lock = threading.Lock()


def _start_background_workers():
    global _background_workers_started
    with _background_workers_lock:
        if _background_workers_started:
            return
        _background_workers_started = True
        threading.Thread(target=_start_bg_scan, daemon=True).start()


@app.before_request
def _boot_background_workers():
    _start_background_workers()

=======
>>>>>>> Stashed changes

GH_HEADERS = {'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'}

def gh(token): return {**GH_HEADERS, 'Authorization': f'token {token}'}


<<<<<<< Updated upstream
class _HttpResponse:
    def __init__(self, status_code, headers, body_text):
        self.status_code = status_code
        self.headers = headers
        self._body_text = body_text

    def json(self):
        return json.loads(self._body_text or '{}')


def _http_request_json(method, url, headers=None, json_body=None, form_body=None, timeout=10):
    request_headers = dict(headers or {})
    body = None

    if json_body is not None:
        body = json.dumps(json_body).encode('utf-8')
        request_headers.setdefault('Content-Type', 'application/json')
    elif form_body is not None:
        body = urlencode(form_body).encode('utf-8')
        request_headers.setdefault('Content-Type', 'application/x-www-form-urlencoded')

    req = urllib_request.Request(url, data=body, headers=request_headers, method=method.upper())

    try:
        with urllib_request.urlopen(req, timeout=timeout) as resp:
            raw_body = resp.read().decode('utf-8')
            return _HttpResponse(getattr(resp, 'status', 200), dict(resp.headers.items()), raw_body)
    except urllib_error.HTTPError as exc:
        raw_body = exc.read().decode('utf-8', errors='replace')
        return _HttpResponse(exc.code, dict(exc.headers.items()), raw_body)

TOKEN_PREFIX = 'v1:'

def _token_cipher() -> Fernet:
    token_secret = os.getenv('TOKEN_ENCRYPTION_KEY') or SECRET_KEY
    key = base64.urlsafe_b64encode(hashlib.sha256(token_secret.encode()).digest())
    return Fernet(key)


def _encrypt_token(token: str) -> str:
    return TOKEN_PREFIX + _token_cipher().encrypt(token.encode()).decode()


def _decrypt_token(token: str | None) -> str | None:
    if not token:
        return None
    if not token.startswith(TOKEN_PREFIX):
        if ALLOW_LEGACY_PLAINTEXT_TOKENS:
            logger.warning('Using legacy plaintext GitHub token from database; re-authenticate user to encrypt it')
            return token
        logger.warning('Refusing legacy plaintext GitHub token from database')
        return None
    try:
        return _token_cipher().decrypt(token[len(TOKEN_PREFIX):].encode()).decode()
    except InvalidToken:
        logger.warning('Stored GitHub token could not be decrypted')
        return None

=======
def _encrypt_github_token(token: str) -> str:
    return fernet.encrypt(token.encode()).decode()


def _decrypt_github_token(ciphertext: str) -> str | None:
    try:
        return fernet.decrypt(ciphertext.encode()).decode()
    except (InvalidToken, ValueError, TypeError):
        return None


def _enqueue_job(function_path, *args, **kwargs):
    if not queue_is_configured():
        logger.error('Background queue unavailable. Set REDIS_URL and run RQ worker.')
        return None
    try:
        job = enqueue_background_job(function_path, *args, **kwargs)
        return job
    except Exception as e:
        logger.error(f"Failed to enqueue {function_path}: {e}")
        return None


def _queue_or_503(function_path, *args, **kwargs):
    job = _enqueue_job(function_path, *args, **kwargs)
    if not job:
        return None, (jsonify({'error': 'Failed to enqueue background job'}), 503)
    return job, None

>>>>>>> Stashed changes
# ── Auth helpers ──────────────────────────────────────────────────────────────
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user' not in session:
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Not authenticated'}), 401
            return redirect('/')
        return f(*args, **kwargs)
    return decorated

def current_user():
    if 'user' not in session:
        return None
    return User.query.filter_by(github_id=session['user']['id']).first()

def _ensure_user_settings(user):
    if not user.settings:
        settings = UserSettings(user_id=user.id)
        db.session.add(settings)
        db.session.commit()
        return settings
    return user.settings

def _react_export_exists():
    return os.path.exists(os.path.join(REACT_DIST_DIR, 'index.html'))

def _react_page_response(route_path=''):
    """Serve the exported Next.js page when available; fall back to legacy templates locally."""
    normalized = route_path.strip('/')
    candidates = []
    if not normalized:
        candidates.append(os.path.join(REACT_DIST_DIR, 'index.html'))
    else:
        candidates.extend([
            os.path.join(REACT_DIST_DIR, normalized, 'index.html'),
            os.path.join(REACT_DIST_DIR, f'{normalized}.html'),
        ])

    for candidate in candidates:
        if os.path.exists(candidate):
            return send_from_directory(os.path.dirname(candidate), os.path.basename(candidate))

    if _react_export_exists():
        return send_from_directory(REACT_DIST_DIR, 'index.html')

    return None

def _page_response(route_path, fallback_template, **context):
    react_response = _react_page_response(route_path)
    if react_response:
        return react_response
    return render_template(fallback_template, **context)

# ── Pages ─────────────────────────────────────────────────────────────────────
@app.route('/')
def landing():
    if 'user' in session:
        portal = session.get('oauth_portal', 'org')
        return redirect('/user/dashboard' if portal == 'user' else '/org/dashboard')
    return _page_response('', 'landing.html')

@app.route('/permissions')
@login_required
def permissions_page():
    portal = session.get('oauth_portal', 'org')
    dashboard_url = '/user/dashboard' if portal == 'user' else '/org/dashboard'
    auth_url = '/api/auth/github/login?scope=user' if portal == 'user' else '/api/auth/github/install'
    return _page_response('permissions', 'permissions.html',
                          user=session['user'], portal=portal,
                          dashboard_url=dashboard_url, auth_url=auth_url)

@app.route('/org/dashboard')
@login_required
def org_dashboard():
    return _page_response('org/dashboard', 'org/dashboard.html', user=session['user'])

@app.route('/user/dashboard')
@login_required
def user_dashboard():
    return _page_response('user/dashboard', 'user/dashboard.html', user=session['user'])

@app.route('/dashboard')
@login_required
def dashboard():
    return redirect('/org/dashboard')

@app.route('/settings')
@login_required
def settings_page():
    return redirect(url_for('org_settings_page'))

@app.route('/org/settings')
@login_required
def org_settings_page():
    return _page_response('org/settings', 'org/settings.html', user=session['user'])

@app.route('/error')
def error_page():
    return _page_response('error', 'error.html')

@app.route('/docs')
def docs_page():
    return _page_response('docs', 'docs.html')

@app.route('/privacy')
def privacy_page():
    return _page_response('privacy', 'privacy.html')

@app.route('/user/login')
def user_login_page():
    return _page_response('user/login', 'user/login.html')

@app.route('/org/login')
def org_login_page():
    return _page_response('org/login', 'org/login.html')

@app.route('/org/signup')
def org_signup_page():
    return _page_response('org/signup', 'org/signup.html')

@app.route('/logout')
@login_required
def logout():
    logger.info(f"Logout: {session['user'].get('username')}")
    session.clear()
    return redirect('/')

# ── CSRF token endpoint ───────────────────────────────────────────────────────
@app.route('/api/csrf-token')
def get_csrf_token():
    return jsonify({'csrf_token': generate_csrf()})

# ── GitHub OAuth ──────────────────────────────────────────────────────────────
@app.route('/login/github')
def github_login():
    state = secrets.token_urlsafe(32)
    session['oauth_state'] = state
    session['oauth_portal'] = 'user' if request.args.get('portal') == 'user' else 'org'
    session.modified = True
    scopes = 'repo read:org write:discussion workflow user:email'
    params = urlencode({
        'client_id': GITHUB_CLIENT_ID,
        'scope': scopes,
        'state': state,
        'allow_signup': 'true',
    })
    url = f'https://github.com/login/oauth/authorize?{params}'
    return redirect(url)


@app.route('/auth/github')
def auth_github():
    """Simplified auth entrypoint. Use `?portal=user` or `?portal=org`.
    Keeps frontend URLs short and stable.
    """
    portal = request.args.get('portal')
    # Backwards-compat: support scope=user or install flag
    if not portal:
        if request.args.get('scope') == 'user':
            portal = 'user'
        elif request.args.get('install'):
            portal = 'org'
        else:
            portal = 'user'
    return redirect(url_for('github_login', portal=portal))

@app.route('/api/auth/github/login')
def api_auth_github_login():
    portal = 'user' if request.args.get('scope') == 'user' else 'org'
    return redirect(url_for('github_login', portal=portal))

@app.route('/api/auth/github/install')
def api_auth_github_install():
    return redirect(url_for('github_login', portal='org'))

@app.route('/callback/github')
@app.route('/auth/github/callback')
def github_callback():
    returned_state = request.args.get('state')
    stored_state = session.get('oauth_state')
    if not returned_state or returned_state != stored_state:
        logger.warning('OAuth state mismatch — possible CSRF')
        return redirect('/?error=invalid_state')
    session.pop('oauth_state', None)

    code = request.args.get('code')
    if not code:
        return redirect('/?error=no_code')

    try:
        # Add retries for transient Heroku DNS issues (Aggressive for 30s H12 limit)
        token_resp = None
        for attempt in range(5):
            try:
                token_resp = _http_request_json(
                    'POST',
                    'https://github.com/login/oauth/access_token',
                    headers={'Accept': 'application/json'},
                    form_body={
                        'client_id': GITHUB_CLIENT_ID,
                        'client_secret': GITHUB_CLIENT_SECRET,
                        'code': code,
                        'state': returned_state,
                    },
                    timeout=4 # Fail fast to allow more retries
                )
                break
            except Exception as e:
                if attempt == 4: raise e
                logger.warning(f"OAuth token attempt {attempt+1} failed: {e}. Retrying...")
                time.sleep(0.5)

        token_data = token_resp.json()
        access_token = token_data.get('access_token')
        if not access_token:
            logger.error(
                "No access token in GitHub OAuth response: "
                f"error={token_data.get('error')}, "
                f"error_description={token_data.get('error_description')}"
            )
            return redirect(url_for('landing', error='no_token'))

        # Fetch user profile with retries
        user_resp = None
        for attempt in range(3):
            try:
                user_resp = _http_request_json('GET', 'https://api.github.com/user', headers=gh(access_token), timeout=5)
                break
            except Exception as e:
                if attempt == 2: raise e
                time.sleep(0.5)

        ud = user_resp.json()
        github_id = ud.get('id')
        username  = ud.get('login')

        # Upsert user in DB
        user = User.query.filter_by(github_id=github_id).first()
        if not user:
            user = User(github_id=github_id, username=username)
            db.session.add(user)
        user.avatar     = ud.get('avatar_url')
        user.name       = ud.get('name') or username
        user.email      = ud.get('email')
        user.last_login = datetime.utcnow()
<<<<<<< Updated upstream
        user.access_token = _encrypt_token(access_token)
=======
        user.access_token = _encrypt_github_token(access_token)
>>>>>>> Stashed changes
        db.session.commit()

        # Ensure user has settings row
        if not user.settings:
            db.session.add(UserSettings(user_id=user.id))
            db.session.commit()

        # Store minimal data in session (NO token in session)
        session['user'] = {
            'id':       github_id,
            'username': username,
            'avatar':   ud.get('avatar_url'),
            'name':     ud.get('name') or username,
            'email':    ud.get('email'),
            'db_id':    user.id,
        }
        session.modified = True

        logger.info(f"Auth OK: {username}")
        return redirect('/permissions')
    except Exception as e:
        logger.error(f"OAuth callback error: {e}")
        return redirect('/?error=oauth_failed')

def get_user_token(user_id: int) -> str | None:
    """Retrieve the stored OAuth token for a user (server-side only)."""
    user = User.query.get(user_id)
<<<<<<< Updated upstream
    return _decrypt_token(user.access_token) if user else None
=======
    if not user or not user.access_token:
        return None

    token = _decrypt_github_token(user.access_token)
    if token:
        return token

    # Fail closed: if token cannot be decrypted, force re-authentication.
    user.access_token = None
    db.session.commit()
    logger.warning(f"Cleared undecryptable token for user_id={user_id}; re-auth required")
    return None
>>>>>>> Stashed changes

# ── API: Verify Scopes ────────────────────────────────────────────────────────
@app.route('/api/verify-permissions')
@login_required
def verify_permissions():
    token = get_user_token(session['user']['db_id'])
    if not token:
        return jsonify({'error': 'Session expired, please re-login'}), 401

    resp = _http_request_json('GET', 'https://api.github.com/user', headers=gh(token), timeout=10)
    if resp.status_code != 200:
        return jsonify({'error': 'Token validation failed'}), 401

    raw     = resp.headers.get('X-OAuth-Scopes', '')
    granted = [s.strip() for s in raw.split(',') if s.strip()]
    required = ['repo', 'read:org', 'write:discussion', 'workflow', 'user:email']

    def satisfied(needed):
        if needed in granted: return True
        parent = needed.split(':')[0]
        return any(g == parent or g.startswith(f'{parent}:') for g in granted)

    missing = [s for s in required if not satisfied(s)]
    return jsonify({'granted': granted, 'required': required, 'missing': missing, 'all_granted': not missing})

# ── API: Discovery Helpers ───────────────────────────────────────────────────────
@app.route('/api/discover-repos', methods=['POST'])
@login_required
def discover_repos():
    try:
        user = current_user()
        token = get_user_token(user.id)
        if not token:
            return jsonify({'error': 'Session expired'}), 401

        repos_map = {}

        # Source 1: user/repos
        page = 1
        while True:
            r = _http_request_json(
                'GET',
                'https://api.github.com/user/repos?' + urlencode({
                    'affiliation': 'owner,collaborator,organization_member',
                    'visibility': 'all',
                    'per_page': 100,
                    'page': page,
                }),
                headers=gh(token),
                timeout=15,
            )
            _handle_rate_limit(r)
            if r.status_code != 200: break
            batch = r.json()
            if not batch: break
            for repo in batch:
                repos_map[repo['full_name']] = _normalize_repo(repo, 'direct')
            if len(batch) < 100: break
            page += 1

        # Source 2: org repos
        orgs_r = _http_request_json('GET', 'https://api.github.com/user/orgs?' + urlencode({'per_page': 100}), headers=gh(token), timeout=10)
        orgs = orgs_r.json() if orgs_r.status_code == 200 else []
        for org in orgs:
            org_login = org.get('login')
            if not org_login: continue
            p = 1
            while True:
                or_ = _http_request_json(
                    'GET',
                    f'https://api.github.com/orgs/{org_login}/repos?' + urlencode({'type': 'all', 'per_page': 100, 'page': p}),
                    headers=gh(token),
                    timeout=15,
                )
                _handle_rate_limit(or_)
                if or_.status_code != 200: break
                ob = or_.json()
                if not ob: break
                for repo in ob:
                    if repo['full_name'] not in repos_map:
                        repos_map[repo['full_name']] = _normalize_repo(repo, 'org')
                if len(ob) < 100: break
                p += 1
     
        # Source 3: Bot's own permissions (for Tiered Logic)
        agent_repos = {}
        if GITHUB_TOKEN:
            ap = 1
            while True:
                ar = _http_request_json(
                    'GET',
                    'https://api.github.com/user/repos?' + urlencode({'per_page': 100, 'page': ap}),
                    headers=gh(GITHUB_TOKEN),
                    timeout=15,
                )
                if ar.status_code != 200: break
                abatch = ar.json()
                if not abatch: break
                for r in abatch:
                    agent_repos[r['full_name']] = 'admin' if r['permissions'].get('admin') else 'write' if r['permissions'].get('push') else 'read'
                if len(abatch) < 100: break
                ap += 1

        if TARGET_REPOS_OVERRIDE:
            repos_map = {k: v for k, v in repos_map.items() if k in TARGET_REPOS_OVERRIDE}

        uname = session['user']['username']
        accessible = [r for r in repos_map.values()
                      if r['permissions'].get('push') or r['permissions'].get('admin')
                      or r.get('owner_login', '').lower() == uname.lower()]
        accessible.sort(key=lambda r: r.get('pushed_at', '') or '', reverse=True)

        # Sync to DB
        existing = {ur.full_name for ur in user.repos}
        for r in accessible:
            if r['full_name'] not in existing:
                db.session.add(UserRepo(
                    user_id=user.id, full_name=r['full_name'],
                    private=r['private'], url=r['url'],
                    language=r['language'],
                    permissions_level=('owner' if r.get('owner_login','').lower()==uname.lower()
                                       else 'admin' if r['permissions'].get('admin')
                                       else 'push'),
                    agent_permission=agent_repos.get(r['full_name'], 'none'),
                    archived=r['archived'], fork=r['fork'],
                ))
            else:
                ur = UserRepo.query.filter_by(user_id=user.id, full_name=r['full_name']).first()
                if ur:
                    ur.agent_permission = agent_repos.get(r['full_name'], 'none')
                    ur.last_synced = datetime.utcnow()
        db.session.commit()

        session['user']['repos'] = [r['full_name'] for r in accessible]
        session.modified = True

        logger.info(f"Discover: {uname} → {len(accessible)} repos")
        return jsonify({'repos': accessible, 'total': len(accessible),
                        'whitelisted': bool(TARGET_REPOS_OVERRIDE)})
    except Exception as e:
        logger.error(f"Discovery error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

def _normalize_repo(r, source):
    return {
        'full_name':   r.get('full_name', ''),
        'name':        r.get('name', ''),
        'private':     r.get('private', False),
        'url':         r.get('html_url', ''),
        'description': r.get('description') or '',
        'language':    r.get('language') or 'Unknown',
        'open_issues': r.get('open_issues_count', 0),
        'stars':       r.get('stargazers_count', 0),
        'pushed_at':   r.get('pushed_at', ''),
        'permissions': r.get('permissions') or {},
        'owner_login': r.get('owner', {}).get('login', ''),
        'fork':        r.get('fork', False),
        'archived':    r.get('archived', False),
        'source':      source,
    }

def _handle_rate_limit(resp):
    remaining = int(resp.headers.get('X-RateLimit-Remaining', 999))
    if remaining < 5:
        from flask import abort
        logger.warning(f"Rate limit low ({remaining} remaining), aborting to avoid 502 gateway timeout")
        abort(429, description="GitHub API rate limit reached.")

# ── API: Auto Provision ───────────────────────────────────────────────────────
@app.route('/api/auto-provision', methods=['POST'])
@login_required
def auto_provision():
    user  = current_user()
    token = get_user_token(user.id)
    repos = session['user'].get('repos', [])
    if not repos:
        return jsonify({'all_provisioned': True, 'results': []})

    results = []
    for full_repo in repos:
        result = _check_and_provision(full_repo, session['user']['username'], token, GITHUB_TOKEN)
        results.append(result)

    all_ok = all(r['status'] != 'error' for r in results)
    return jsonify({'all_provisioned': all_ok, 'results': results})

def _check_and_provision(full_repo, username, user_token, server_token):
    base = {'repo': full_repo, 'url': f'https://github.com/{full_repo}'}
    resp = _http_request_json('GET', f'https://api.github.com/repos/{full_repo}', headers=gh(user_token), timeout=10)
    if resp.status_code == 404:
        return {**base, 'status': 'error', 'message': 'Not found or no access'}
    if resp.status_code != 200:
        return {**base, 'status': 'error', 'message': f'HTTP {resp.status_code}'}

    rd    = resp.json()
    perms = rd.get('permissions', {})
    owner = rd.get('owner', {}).get('login', '')

    if owner.lower() == username.lower():
        return {**base, 'status': 'owner', 'message': 'You own this repository'}
    if perms.get('admin'):
        return {**base, 'status': 'admin', 'message': 'Admin access confirmed'}
    if perms.get('push'):
        return {**base, 'status': 'push', 'message': 'Write access confirmed'}
    if perms.get('pull') and server_token:
        owner_name, repo_name = full_repo.split('/', 1)
        r = _http_request_json(
            'PUT',
            f'https://api.github.com/repos/{owner_name}/{repo_name}/collaborators/{username}',
            headers=gh(server_token),
            json_body={'permission': 'push'},
            timeout=10,
        )
        if r.status_code == 201:
            return {**base, 'status': 'invited', 'message': 'Invitation sent ✓'}
        if r.status_code in (204, 422):
            return {**base, 'status': 'push', 'message': 'Write access confirmed'}
    return {**base, 'status': 'read', 'message': 'Read-only access'}

# ── PWA & Static Assets ───────────────────────────────────────────────────────
@app.route('/_next/<path:path>')
def serve_next_asset(path):
    return send_from_directory(os.path.join(REACT_DIST_DIR, '_next'), path)

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(FRONTEND_DIR, 'icons'), 'icon-192.png')

@app.route('/icons/<path:path>')
def send_icons(path):
    return send_from_directory(os.path.join(FRONTEND_DIR, 'icons'), path)

@app.route('/sw.js')
def serve_sw():
    return send_from_directory(FRONTEND_DIR, 'sw.js', mimetype='application/javascript')

@app.route('/manifest.json')
def serve_manifest():
    return send_from_directory(FRONTEND_DIR, 'manifest.json', mimetype='application/json')

@app.route('/offline')
def offline_page():
    return _page_response('offline', 'offline.html')

@app.route('/offline.html')
def serve_offline():
    return _page_response('offline', 'offline.html')

# ── API: Scan ─────────────────────────────────────────────────────────────────
@app.route('/api/scan', methods=['POST'])
@login_required
def trigger_scan():
    user  = current_user()
    repos = session['user'].get('repos') or [repo.full_name for repo in user.repos] or TARGET_REPOS_OVERRIDE
    if not repos:
        return jsonify({'success': False, 'error': 'No repos discovered yet.'}), 400

    settings = user.settings
    excluded = settings.get_excluded_list() if settings else []
    scan_repos = [r for r in repos if r not in excluded]
    if not scan_repos:
        return jsonify({'success': False, 'error': 'No active repos available to scan.'}), 400

    job, err = _queue_or_503(
        'api_server.run_manual_scan_job',
        user.id,
        session['user']['username'],
        scan_repos,
    )
    if err:
        return err

<<<<<<< Updated upstream
    def execute_manual_scan():
        with app.app_context():
            try:
                settings_obj = UserSettings.query.filter_by(user_id=user_id).first()
                scanner = PRHealthScanner(
                    token, scan_repos, assignee=ASSIGNEE_USERNAME,
                    auto_label_conflict=settings_obj.auto_label_conflict if settings_obj else True,
                    tag_author_on_fail=settings_obj.tag_author_on_fail if settings_obj else False,
                )
                results = scanner.scan_all_repos()
                _ingest_scan_results(results, user_id, scanner=scanner)
                socketio.emit('update', _get_user_data(user_id), to=username)
                socketio.emit('scan_complete', {'status': 'success'}, to=username)
            except Exception as e:
                db.session.rollback()
                logger.error(f"Manual scan error: {e}")
            finally:
                db.session.remove() # CRITICAL: Release connection back to Neon pool
=======
    return jsonify({'success': True, 'message': 'Scan queued', 'job_id': job.id}), 202
>>>>>>> Stashed changes


@csrf.exempt
@app.route('/api/internal/fallback-sync', methods=['POST'])
def enqueue_fallback_sync():
    if not INTERNAL_CRON_TOKEN:
        return jsonify({'error': 'INTERNAL_CRON_TOKEN is not configured'}), 503

    provided = request.headers.get('X-Internal-Token', '')
    if not hmac.compare_digest(provided, INTERNAL_CRON_TOKEN):
        return jsonify({'error': 'Forbidden'}), 403

    job, err = _queue_or_503('api_server.run_fallback_sync_job')
    if err:
        return err

    return jsonify({'queued': True, 'job_id': job.id}), 202

@app.route('/api/repos')
@login_required
def list_repos():
    user  = current_user()
    repos = [{'full_name': ur.full_name, 'private': ur.private,
               'language': ur.language, 'permissions_level': ur.permissions_level,
               'agent_permission': ur.agent_permission,
               'archived': ur.archived, 'fork': ur.fork,
               'last_synced': ur.last_synced.isoformat() if ur.last_synced else None}
             for ur in user.repos]
    return jsonify({'repos': repos, 'total': len(repos)})

@app.route('/api/health')
def health_check():
    """Deep health check: verifies DB connectivity and returns operational stats."""
    health = {
        'status': 'ok',
        'service': 'Bob PR Health Scanner',
        'timestamp': datetime.utcnow().isoformat(),
        'database': 'unknown',
        'users': 0,
        'tracked_repos': 0,
    }
    try:
        from sqlalchemy import text
        with db.engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        health['database'] = 'connected'
        health['users'] = User.query.count()
        health['tracked_repos'] = UserRepo.query.count()
    except Exception as e:
        health['status'] = 'degraded'
        health['database'] = f'error: {str(e)[:100]}'
    return jsonify(health)

@app.route('/api/issues')
@login_required
def get_issues():
    user = current_user()
    repo_filter = request.args.get('repo')
    q = PRIssue.query.filter_by(user_id=user.id)
    if repo_filter:
        q = q.filter_by(repo=repo_filter)
    issues = q.order_by(PRIssue.updated_at.desc()).all()
    return jsonify({'issues': [i.to_dict() for i in issues]})

# ── API: Settings ─────────────────────────────────────────────────────────────
@app.route('/api/settings', methods=['GET', 'POST'])
@login_required
def user_settings():
    user = current_user()
    s = _ensure_user_settings(user)

    if request.method == 'GET':
        return jsonify({
            'scan_interval':  s.scan_interval,
            'excluded_repos': s.get_excluded_list(),
            'notify_in_app':  s.notify_in_app,
            'slack_webhook': s.slack_webhook,
            'discord_webhook': s.discord_webhook,
            'auto_label_conflict': s.auto_label_conflict,
            'tag_author_on_fail': s.tag_author_on_fail,
        })

    data = request.get_json() or {}
    s = user.settings
    if 'scan_interval'  in data: s.scan_interval     = int(data['scan_interval'])
    if 'excluded_repos' in data: s.excluded_repos     = ','.join(data['excluded_repos'])
    if 'notify_in_app'  in data: s.notify_in_app      = bool(data['notify_in_app'])
    if 'push_subscription' in data: s.push_subscription = data['push_subscription']
    if 'slack_webhook' in data: s.slack_webhook = data['slack_webhook']
    if 'discord_webhook' in data: s.discord_webhook = data['discord_webhook']
    if 'auto_label_conflict' in data: s.auto_label_conflict = bool(data['auto_label_conflict'])
    if 'tag_author_on_fail' in data: s.tag_author_on_fail = bool(data['tag_author_on_fail'])
    s.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'saved': True})

# ── API: Delete Account ───────────────────────────────────────────────────────
@app.route('/api/account/delete', methods=['POST'])
@login_required
def delete_account():
    user = current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    try:
        username = user.username
        db.session.delete(user)
        db.session.commit()
        session.clear()
        logger.info(f"User account deleted permanently: {username}")
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to delete account: {e}")
        return jsonify({'error': 'Failed to delete account due to a server error'}), 500

# ── API: Update Issue Status ──────────────────────────────────────────────────
@app.route('/api/issues/<int:issue_id>/status', methods=['POST'])
@login_required
def update_issue_status(issue_id):
    user   = current_user()
    issue  = PRIssue.query.filter_by(id=issue_id, user_id=user.id).first_or_404()
    data   = request.get_json() or {}
    status = data.get('status')
    if status not in ('pending', 'in_progress', 'failed', 'resolved'):
        return jsonify({'error': 'Invalid status'}), 400
    issue.status     = status
    issue.updated_at = datetime.utcnow()
    db.session.commit()
    socketio.emit('update', _get_user_data(user.id), to=session['user']['username'])
    return jsonify({'saved': True, 'issue': issue.to_dict()})

# ── API: Re-run Failed CI ─────────────────────────────────────────────────────
@app.route('/api/issues/<int:issue_id>/rerun-ci', methods=['POST'])
@login_required
def rerun_ci(issue_id):
    """Re-run a failed GitHub Actions workflow."""
    user = current_user()
    issue = PRIssue.query.filter_by(id=issue_id, user_id=user.id).first_or_404()
    if not issue.run_id:
        return jsonify({'error': 'No CI run ID associated with this issue'}), 400
    token = get_user_token(user.id)
    if not token:
        return jsonify({'error': 'Session expired, please re-login'}), 401
    scanner = PRHealthScanner(token, [], assignee=ASSIGNEE_USERNAME)
    result = scanner.rerun_workflow(issue.repo, int(issue.run_id))
    if result.get('success'):
        issue.status = 'in_progress'
        issue.updated_at = datetime.utcnow()
        db.session.commit()
        socketio.emit('update', _get_user_data(user.id), to=session['user']['username'])
        return jsonify({'success': True, 'message': 'CI re-run triggered'})
    return jsonify({'error': result.get('error', 'Failed to re-run CI')}), 500

# ── API: Request Review ───────────────────────────────────────────────────────
@app.route('/api/issues/<int:issue_id>/request-review', methods=['POST'])
@login_required
def request_review(issue_id):
    """Request a review for a PR from specified GitHub users."""
    user = current_user()
    issue = PRIssue.query.filter_by(id=issue_id, user_id=user.id).first_or_404()
    if not issue.pr_number:
        return jsonify({'error': 'No PR number associated with this issue'}), 400
    data = request.get_json() or {}
    reviewers = data.get('reviewers', [])
    if not reviewers:
        return jsonify({'error': 'No reviewers specified'}), 400
    token = get_user_token(user.id)
    if not token:
        return jsonify({'error': 'Session expired, please re-login'}), 401
    scanner = PRHealthScanner(token, [], assignee=ASSIGNEE_USERNAME)
    result = scanner.request_review(issue.repo, issue.pr_number, reviewers)
    if 'error' not in result:
        return jsonify({'success': True, 'message': f'Review requested from {", ".join(reviewers)}'})
    return jsonify({'error': result.get('error', 'Failed to request review')}), 500


# ── API: GitHub Webhook ───────────────────────────────────────────────────────
@csrf.exempt
@app.route('/api/webhooks/github', methods=['POST'])
def github_webhook():
<<<<<<< Updated upstream
    if not WEBHOOK_SECRET and not ALLOW_UNSIGNED_WEBHOOKS:
        logger.warning('Rejected unsigned GitHub webhook because WEBHOOK_SECRET is not configured')
        abort(403)

    if WEBHOOK_SECRET:
        sig = request.headers.get('X-Hub-Signature-256', '')
        expected = 'sha256=' + hmac.new(
            WEBHOOK_SECRET.encode(), request.data, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            logger.warning('Webhook signature mismatch')
            abort(403)
=======
    if not WEBHOOK_SECRET:
        logger.error('Rejected webhook request: WEBHOOK_SECRET is not configured')
        abort(503)

    sig = request.headers.get('X-Hub-Signature-256', '')
    if not sig:
        logger.warning('Webhook signature missing')
        abort(403)

    expected = 'sha256=' + hmac.new(
        WEBHOOK_SECRET.encode(), request.data, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        logger.warning('Webhook signature mismatch')
        abort(403)
>>>>>>> Stashed changes

    event   = request.headers.get('X-GitHub-Event', '')
    payload = request.get_json(silent=True) or {}
    repo_name = payload.get('repository', {}).get('full_name', '')

    logger.info(f"Webhook: {event} → {repo_name}")

    if event == 'pull_request':
        action = payload.get('action')
        pr     = payload.get('pull_request', {})
        if action == 'closed' and pr.get('merged'):
            # Mark as resolved for any user tracking this repo
            _webhook_resolve_pr(repo_name, pr.get('number'))
        elif action in {'opened', 'reopened', 'synchronize', 'ready_for_review'}:
            _webhook_check_pr_conflict(repo_name, pr)

    elif event == 'check_suite':
        cs = payload.get('check_suite', {})
        # check_suite events are a real-time signal to refresh this repo.
        if cs.get('status') == 'completed':
            _webhook_ci_failure(repo_name, cs)

    elif event == 'pull_request_review':
        action = payload.get('action')
        if action in {'submitted', 'dismissed', 'edited'}:
            _webhook_pr_review(repo_name, payload.get('pull_request', {}))

    # Handle GitHub App installation events so repos get registered in DB
    elif event == 'installation' or event == 'installation_repositories':
        action = payload.get('action')
        # Payload may contain repositories or repositories_added/removed
        repos = payload.get('repositories', []) or payload.get('repositories_added', [])
        repos_removed = payload.get('repositories_removed', [])
        # Normalize list of repo dicts to full_name strings
        added = [r.get('full_name') for r in repos if r.get('full_name')]
        removed = [r.get('full_name') for r in repos_removed if r.get('full_name')]

        logger.info(f"Installation event ({action}) — added: {added}, removed: {removed}")

        # For added repos: upsert a UserRepo for any user whose username matches the repo owner
        for full in added:
            try:
                owner = full.split('/', 1)[0]
                repo_name = full
                users = User.query.filter_by(username=owner).all()
                for u in users:
                    existing = UserRepo.query.filter_by(user_id=u.id, full_name=repo_name).first()
                    if not existing:
                        ur = UserRepo(user_id=u.id, full_name=repo_name, private=False, url=f'https://github.com/{repo_name}', language=None)
                        db.session.add(ur)
                        logger.info(f"Registered repo {repo_name} for user {u.username} via installation payload")
                db.session.commit()
                # Notify affected users
                _emit_to_repo_owners(repo_name)
            except Exception as e:
                db.session.rollback()
                logger.error(f"Failed to register repo from installation webhook: {e}")

        # For removed repos: mark them archived or remove from user_repos
        for full in removed:
            try:
                urs = UserRepo.query.filter_by(full_name=full).all()
                for ur in urs:
                    db.session.delete(ur)
                db.session.commit()
                logger.info(f"Removed repo entries for {full} via installation_repositories payload")
                # Notify previous owners that this repo was removed
                _emit_to_repo_owners(full)
            except Exception as e:
                db.session.rollback()
                logger.error(f"Failed to remove repo from installation webhook: {e}")

    return jsonify({'ok': True}), 200

def _webhook_resolve_pr(repo, pr_number):
    key   = f'{repo}#{pr_number}'
    issues = PRIssue.query.filter_by(repo=repo, issue_key=key).all()
    if issues:
        for issue in issues:
            issue.status     = 'resolved'
            issue.updated_at = datetime.utcnow()
        db.session.commit()
        _emit_to_repo_owners(repo)

def _webhook_check_pr_conflict(repo, pr):
    _scan_repo_for_all_users(repo, reason=f"pull_request:{pr.get('number')}")

def _webhook_ci_failure(repo, check_suite):
    _scan_repo_for_all_users(repo, reason=f"check_suite:{check_suite.get('id')}")

def _webhook_pr_review(repo, pr):
    _scan_repo_for_all_users(repo, reason=f"pull_request_review:{pr.get('number')}")

def _scan_repo_for_all_users(repo_full_name, reason='webhook'):
    user_ids = [ur.user_id for ur in UserRepo.query.filter_by(full_name=repo_full_name).all()]
    if not user_ids:
        return
    for user_id in user_ids:
        _enqueue_job('api_server.run_repo_scan_job', user_id, repo_full_name, reason)


def run_manual_scan_job(user_id, username, scan_repos):
    with app.app_context():
        try:
            token = get_user_token(user_id) or GITHUB_TOKEN
            if not token:
                logger.warning(f"Manual scan skipped for user {user_id}: no token")
                return
            scanner = PRHealthScanner(token, scan_repos, assignee=ASSIGNEE_USERNAME)
            results = scanner.scan_all_repos()
            _ingest_scan_results(results, user_id, scanner=scanner)
            socketio.emit('update', _get_user_data(user_id), to=username)
            socketio.emit('scan_complete', {'status': 'success'}, to=username)
        except Exception as e:
            db.session.rollback()
            logger.error(f"Manual scan job error for user {user_id}: {e}")
        finally:
            db.session.remove()


def run_repo_scan_job(user_id, repo_full_name, reason='webhook'):
    with app.app_context():
        try:
            _scan_repo_for_user(user_id, repo_full_name, reason=reason)
        finally:
            db.session.remove()

def _scan_repo_for_user(user_id, repo_full_name, reason='fallback'):
    try:
        user = db.session.get(User, user_id)
        if not user:
            return

        settings = user.settings
        excluded = settings.get_excluded_list() if settings else []
        if repo_full_name in excluded:
            return

        token = get_user_token(user.id) or GITHUB_TOKEN
        if not token:
            return

        logger.info(f"Repo scan ({reason}): {user.username} -> {repo_full_name}")
        scanner = PRHealthScanner(token, [repo_full_name], assignee=ASSIGNEE_USERNAME)
        result = scanner.scan_repository(repo_full_name)
        _ingest_scan_results([result], user.id, scanner=scanner)

        tracked_repo = UserRepo.query.filter_by(user_id=user.id, full_name=repo_full_name).first()
        if tracked_repo:
            tracked_repo.last_synced = datetime.utcnow()
            db.session.commit()

        socketio.emit('update', _get_user_data(user.id), to=user.username)
    except Exception as e:
        db.session.rollback()
        logger.error(f"Repo scan failed for user {user_id}, repo {repo_full_name}: {e}")

def _emit_to_repo_owners(repo_full_name):
    """Emit real-time update to all users who track this repo."""
    user_repos = UserRepo.query.filter_by(full_name=repo_full_name).all()
    for ur in user_repos:
        socketio.emit('update', _get_user_data(ur.user_id), to=ur.user.username)

# ── DB helpers ────────────────────────────────────────────────────────────────
def _ingest_scan_results(results, user_id, scanner=None):
    settings = UserSettings.query.filter_by(user_id=user_id).first()
    new_issues = []  # Track new issues for notification dispatch

    for result in results:
        repo = result['repo']

        # 1. Merge conflicts
        for pr in result.get('conflicting_prs', []):
            key = f"{repo}#{pr['pr']}"
            issue = PRIssue.query.filter_by(user_id=user_id, issue_key=key).first()
            if not issue:
                issue = PRIssue(
                    user_id=user_id, repo=repo, issue_key=key,
                    title=pr['title'], url=pr['url'],
                    pr_number=pr['pr'], branch=pr.get('head_branch'),
                    issue_type='merge_conflict', status='pending',
                    author=pr.get('author'),
                )
                db.session.add(issue)
                new_issues.append(issue)

            if scanner and issue.status == 'pending':
                _trigger_auto_comment(issue, scanner)

        # 2. CI failures
        for f in result.get('workflow_failures', []):
            key = f"{repo}#run{f['id']}"
            issue = PRIssue.query.filter_by(user_id=user_id, issue_key=key).first()
            if not issue:
                issue = PRIssue(
                    user_id=user_id, repo=repo, issue_key=key,
                    title=f"CI: {f['name']} failed on {f['branch']}",
                    url=f['html_url'], run_id=str(f['id']), branch=f['branch'],
                    pr_number=f.get('pr'),
                    issue_type='ci_failure', status='pending',
                    author=f.get('author'),
                )
                db.session.add(issue)
<<<<<<< Updated upstream
                new_issues.append(issue)

        # 3. Review issues (NEW)
        for ri in result.get('review_issues', []):
            key = f"{repo}#review{ri['pr']}"
            issue = PRIssue.query.filter_by(user_id=user_id, issue_key=key).first()
            if not issue:
                issue = PRIssue(
                    user_id=user_id, repo=repo, issue_key=key,
                    title=f"Changes requested on PR #{ri['pr']}: {ri['title']}",
                    url=ri['url'], pr_number=ri['pr'], branch=ri.get('head_branch'),
                    issue_type='review_issue', status='pending',
                    author=ri.get('author'),
                )
                db.session.add(issue)
                new_issues.append(issue)

        # 4. Stale PRs (NEW)
        for sp in result.get('stale_prs', []):
            key = f"{repo}#stale{sp['pr']}"
            issue = PRIssue.query.filter_by(user_id=user_id, issue_key=key).first()
            if not issue:
                issue = PRIssue(
                    user_id=user_id, repo=repo, issue_key=key,
                    title=f"Stale PR #{sp['pr']} ({sp['days_since_update']}d idle): {sp['title']}",
                    url=sp['url'], pr_number=sp['pr'], branch=sp.get('head_branch'),
                    issue_type='stale_pr', status='pending',
                    author=sp.get('author'),
                )
                db.session.add(issue)
                new_issues.append(issue)

        # 5. Oversized PRs (NEW)
        for op in result.get('oversized_prs', []):
            key = f"{repo}#size{op['pr']}"
            issue = PRIssue.query.filter_by(user_id=user_id, issue_key=key).first()
            if not issue:
                issue = PRIssue(
                    user_id=user_id, repo=repo, issue_key=key,
                    title=f"Large PR #{op['pr']} ({op['total_changes']} lines): {op['title']}",
                    url=op['url'], pr_number=op['pr'], branch=op.get('head_branch'),
                    issue_type='oversized_pr', status='pending',
                    author=op.get('author'),
                )
                db.session.add(issue)
                new_issues.append(issue)

=======
            elif f.get('pr') and not issue.pr_number:
                issue.pr_number = f.get('pr')

            if scanner and issue.status == 'pending':
                _trigger_auto_comment(issue, scanner)
    
>>>>>>> Stashed changes
    db.session.commit()

    # Dispatch real notifications for new issues
    if new_issues and settings:
        for issue in new_issues:
            try:
                dispatch_notifications(
                    slack_webhook=settings.slack_webhook,
                    discord_webhook=settings.discord_webhook,
                    issue_type=issue.issue_type,
                    title=issue.title or '',
                    repo=issue.repo,
                    url=issue.url or '',
                    author=issue.author or 'Unknown',
                )
            except Exception as e:
                logger.error(f"Notification dispatch error: {e}")

def _trigger_auto_comment(issue, scanner):
    if not issue.pr_number:
        return
    
    # Check if Bob has write access to this specific repo
    ur = UserRepo.query.filter_by(user_id=issue.user_id, full_name=issue.repo).first()
    if not ur or ur.agent_permission not in ('write', 'admin'):
        logger.info(f"Skipping auto-comment on {issue.repo}#{issue.pr_number} (Read-only or No Access)")
        return
    
    msg = (
        f"🤖 **Bob PR Health Alert**\n\n"
        f"Hey @{scanner.assignee}, I've detected a **{issue.issue_type.replace('_', ' ')}** on this PR.\n"
        f"You can track the resolution progress on the [Bob Dashboard](https://bob-7ae2.onrender.com).\n\n"
        f"*Status: Flagged for attention (continuously updated by Bob)*"
    )

    logger.info(f"Upserting PR status comment on {issue.repo}#{issue.pr_number}")
    resp = scanner.upsert_status_comment(issue.repo, issue.pr_number, msg)

    if 'id' in resp or 'url' in resp:
        issue.last_commented_at = datetime.utcnow()
        if not resp.get('unchanged'):
            issue.comment_count = (issue.comment_count or 0) + 1
        db.session.commit() # Commit IMMEDIATELY to prevent race conditions
    else:
        logger.warning(f"Failed to auto-comment: {resp}")

def _get_user_data(user_id):
    user = db.session.get(User, user_id)
    username = (user.username if user else '').lower()
    issues = PRIssue.query.filter_by(user_id=user_id).order_by(PRIssue.updated_at.desc()).all()
    by_status = {'pending': [], 'in_progress': [], 'failed': [], 'resolved': []}
    for i in issues:
        by_status.get(i.status, by_status['pending']).append(i.to_dict())
        
    user_repos = UserRepo.query.filter_by(user_id=user_id).all()
    settings = UserSettings.query.filter_by(user_id=user_id).first()
    excluded = settings.get_excluded_list() if settings else []
    
    repos_list = []
    for ur in user_repos:
        repo_issues = [i for i in issues if i.repo == ur.full_name and i.status != 'resolved']
        repos_list.append({
            'full_name': ur.full_name,
            'private': ur.private,
            'url': ur.url,
            'archived': ur.archived,
            'fork': ur.fork,
            'last_synced': ur.last_synced.isoformat() if ur.last_synced else None,
            'is_active': ur.full_name not in excluded,
            'issue_count': len(repo_issues),
            'permission': ur.permissions_level,
            'agent_permission': ur.agent_permission,
            'language': ur.language,
        })

    # Compute additional stats expected by the frontend
    open_issues = [i for i in issues if i.status != 'resolved']
    conflicts_count = len([i for i in open_issues if i.issue_type == 'merge_conflict'])
    failing_count = len([i for i in open_issues if i.issue_type == 'ci_failure'])
    review_issues_count = len([i for i in open_issues if i.issue_type == 'review_issue'])
    stale_count = len([i for i in open_issues if i.issue_type == 'stale_pr'])
    oversized_count = len([i for i in open_issues if i.issue_type == 'oversized_pr'])
    ready_count = len([r for r in repos_list if r['is_active'] and r['issue_count'] == 0])

    stats = {
        'pending': len(by_status['pending']),
        'in_progress': len(by_status['in_progress']),
        'failed': len(by_status['failed']),
        'resolved': len(by_status['resolved']),
        'total': len(issues),
        'conflicts': conflicts_count,
        'failing': failing_count,
        'review_issues': review_issues_count,
        'stale': stale_count,
        'oversized': oversized_count,
        'ready': ready_count
    }

    # Construct the combined list of PRs expected by the legacy frontend
    prs_list = []
    for i in issues:
        prs_list.append({
            'id': i.id,
            'repo': i.repo,
            'title': i.title,
            'number': i.pr_number or (i.run_id if i.run_id else 'N/A'),
            'author': i.author or 'Unknown',
            'ci_status': 'Failed' if i.issue_type == 'ci_failure' and i.status != 'resolved' else 'Passing',
            'merge_health': 'Conflict' if i.issue_type == 'merge_conflict' and i.status != 'resolved' else 'Healthy',
            'status': i.status
        })

    active_my_issues = [
        i for i in issues
        if i.status != 'resolved' and username and (i.author or '').lower() == username
    ]
    my_prs = [
        pr for pr in prs_list
        if username and (pr.get('author') or '').lower() == username
    ]
    action_items = [
        {
            'id': i.id,
            'kind': i.issue_type,
            'title': i.title or f"{i.repo} needs attention",
            'description': f"{i.repo} has a {i.issue_type.replace('_', ' ')} requiring follow-up.",
            'url': i.url,
            'repo': i.repo,
        }
        for i in active_my_issues
    ]

    return {
        **by_status,
        'stats': stats,
        'repos': repos_list,
        'prs': prs_list,
        'my_prs': my_prs,
        'action_items': action_items,
    }

def _get_app_state(user):
    settings = _ensure_user_settings(user)
    dashboard = _get_user_data(user.id)
    return {
        'user': {
            'id': user.id,
            'github_id': user.github_id,
            'username': user.username,
            'name': user.name,
            'email': user.email,
            'avatar': user.avatar,
            'last_login': user.last_login.isoformat() if user.last_login else None,
        },
        'dashboard': dashboard,
        'settings': {
            'scan_interval': settings.scan_interval,
            'excluded_repos': settings.get_excluded_list(),
            'notify_in_app': settings.notify_in_app,
            'slack_webhook': settings.slack_webhook,
            'discord_webhook': settings.discord_webhook,
            'auto_label_conflict': settings.auto_label_conflict,
            'tag_author_on_fail': settings.tag_author_on_fail,
            'updated_at': settings.updated_at.isoformat() if settings.updated_at else None,
        },
        'meta': {
            'scan_interval_seconds': settings.scan_interval,
            'tracked_repo_count': len(dashboard.get('repos', [])),
            'active_repo_count': len([repo for repo in dashboard.get('repos', []) if repo.get('is_active')]),
            'target_repos_configured': bool(TARGET_REPOS_OVERRIDE),
            'websocket_path': '/socket.io',
        }
    }
 
@app.route('/api/app-state')
@login_required
def get_app_state():
    user = current_user()
    return jsonify(_get_app_state(user))

@app.route('/api/dashboard-data')
@login_required
def get_dashboard_data():
    return jsonify(_get_user_data(session['user']['db_id']))

# ── WebSocket ─────────────────────────────────────────────────────────────────
@socketio.on('connect')
def handle_connect(auth=None):
    if 'user' not in session:
        return False  # reject unauthenticated connections
    username = session['user']['username']
    join_room(username)
    logger.info(f"WS connect: {username}")
    emit('update', _get_user_data(session['user']['db_id']))

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"WS disconnect: {session.get('user', {}).get('username')}")

@socketio.on('request_update')
def handle_request_update():
    if 'user' not in session:
        return
    emit('update', _get_user_data(session['user']['db_id']))

# ── Background Scanner ────────────────────────────────────────────────────────
def run_fallback_sync_job():
    with app.app_context():
        try:
            user_ids = [u.id for u in User.query.all()]
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to fetch users for fallback sync: {e}")
            db.session.remove()
            return

        for uid in user_ids:
            try:
                user = db.session.get(User, uid)
                if not user:
                    continue

                settings = user.settings
                excluded = set(settings.get_excluded_list() if settings else [])
                stale_cutoff = datetime.utcnow().timestamp() - (STALE_RESYNC_HOURS * 3600)

                repos = []
                for ur in user.repos:
                    if ur.full_name in excluded:
                        continue
                    if not ur.last_synced or ur.last_synced.timestamp() <= stale_cutoff:
                        repos.append(ur.full_name)

                unresolved_repos = {
                    i.repo for i in PRIssue.query.filter_by(user_id=user.id).all()
                    if i.status in {'pending', 'in_progress', 'failed'}
                }
                prioritized = [r for r in repos if r in unresolved_repos]
                remaining = [r for r in repos if r not in unresolved_repos]
                fallback_targets = (prioritized + remaining)[:FALLBACK_REPO_LIMIT]

                if not fallback_targets:
                    continue

                logger.info(
                    f"Fallback sync job: {user.username} -> {len(fallback_targets)} stale repos"
                )
                for repo_name in fallback_targets:
                    _scan_repo_for_user(user.id, repo_name, reason='daily_fallback')

            except Exception as e:
                db.session.rollback()
                logger.error(f"Fallback sync job error for user {uid}: {e}")
            finally:
                db.session.remove()
<<<<<<< Updated upstream
                continue

        # Step 2: Process each user in their own DB context
        for uid in user_ids:
            with app.app_context():
                try:
                    user = db.session.get(User, uid)
                    if not user:
                        continue

                    token = get_user_token(user.id) or GITHUB_TOKEN
                    if not token:
                        continue

                    settings = user.settings
                    excluded = settings.get_excluded_list() if settings else []
                    repos = [ur.full_name for ur in user.repos if ur.full_name not in excluded]

                    if not repos:
                        continue

                    logger.info(f"BG scan: {user.username} → {len(repos)} repos")
                    scanner = PRHealthScanner(
                        token, repos, assignee=ASSIGNEE_USERNAME,
                        auto_label_conflict=settings.auto_label_conflict if settings else True,
                        tag_author_on_fail=settings.tag_author_on_fail if settings else False,
                    )
                    results = scanner.scan_all_repos()
                    _ingest_scan_results(results, user.id)
                    socketio.emit('update', _get_user_data(user.id), to=user.username)

                except Exception as e:
                    db.session.rollback()
                    logger.error(f"BG scan error for user {uid}: {e}")
                finally:
                    # Crucial: Return the connection to the Neon DB pool
                    db.session.remove()
=======
>>>>>>> Stashed changes

@app.route('/<path:route_path>')
def react_fallback(route_path):
    legacy_redirects = {
        'index.html': '/',
        'landing.html': '/',
        'permissions.html': '/permissions',
        'docs.html': '/docs',
        'privacy.html': '/privacy',
        'error.html': '/error',
        'offline.html': '/offline',
        'user/login.html': '/user/login',
        'user/dashboard.html': '/user/dashboard',
        'org/login.html': '/org/login',
        'org/signup.html': '/org/signup',
        'org/dashboard.html': '/org/dashboard',
        'org/settings.html': '/org/settings',
    }
    if route_path in legacy_redirects:
        return redirect(legacy_redirects[route_path], code=301)

    static_exts = ('.css', '.js', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.ico', '.json', '.txt')
    if route_path.endswith(static_exts):
        asset_path = os.path.normpath(os.path.join(FRONTEND_DIR, route_path))
        frontend_root = os.path.normpath(FRONTEND_DIR)
        if asset_path.startswith(frontend_root) and os.path.isfile(asset_path):
            return send_from_directory(os.path.dirname(asset_path), os.path.basename(asset_path))
        abort(404)

    protected_routes = ('org/dashboard', 'user/dashboard', 'org/settings', 'permissions')
    if route_path in protected_routes and 'user' not in session:
        return redirect('/')

    backend_prefixes = ('api/', 'auth/', 'login/', 'callback/', 'socket.io/')
    if route_path.startswith(backend_prefixes):
        abort(404)

    react_response = _react_page_response(route_path)
    if react_response:
        return react_response
    abort(404)

# ── Entry Point ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    logger.info("Bob PR Health Scanner starting up")
    port = int(os.getenv('PORT', 5000))
    _local_dev = (_sys.platform == 'win32')
    socketio.run(app, host='0.0.0.0', port=port, debug=False,
                 allow_unsafe_werkzeug=_local_dev)
