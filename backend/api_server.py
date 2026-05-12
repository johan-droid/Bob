"""
api_server.py — Bob PR Health Scanner
────────────────────────────────────────────────────────────────────────────
Zero-config repo discovery: TARGET_REPOS is optional.
On login, the system automatically discovers EVERY repo the user has access
to (personal + all orgs) using their OAuth token, stores them in the session,
and uses them for live PR health scanning.

Flow:
  1. GitHub OAuth login → /callback/github
  2. /permissions page loads → JS calls:
       GET  /api/verify-permissions   – check OAuth scopes
       POST /api/discover-repos       – auto-discover all accessible repos
       POST /api/auto-provision       – verify & report access level per repo
  3. PR scanning uses the discovered repos (session-stored)
  4. Background thread continuously scans all known repos across all sessions
────────────────────────────────────────────────────────────────────────────
"""

from flask import Flask, jsonify, request, render_template, redirect, session
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import os
from dotenv import load_dotenv
from pr_health_scanner import PRHealthScanner
from datetime import datetime
import threading
import time
import requests

load_dotenv()

app = Flask(__name__,
            static_folder='../frontend',
            static_url_path='',
            template_folder='../frontend')
app.secret_key = os.getenv('SECRET_KEY', os.urandom(24))
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

GITHUB_TOKEN      = os.getenv("GITHUB_TOKEN")          # Server PAT (optional, used as fallback)
GITHUB_CLIENT_ID  = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
# TARGET_REPOS is now OPTIONAL — used only as an explicit whitelist/override.
# If empty or unset, all repos the user has access to are discovered automatically.
TARGET_REPOS_OVERRIDE = [r.strip() for r in os.getenv("TARGET_REPOS", "").split(",") if r.strip()]

# ── In-memory stores ──────────────────────────────────────────────────────────
pr_status_db: dict   = {}              # { "owner/repo#NNN": { ...pr data } }
authorized_users: set = set()
# Per-user repo registry: { username: ["owner/repo", ...] }
# Populated on login, updated on re-scan.
user_repo_registry: dict = {}

GITHUB_HEADERS = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}


def gh_headers(token: str) -> dict:
    return {**GITHUB_HEADERS, "Authorization": f"token {token}"}


# ─────────────────────────────────────────────────────────────────────────────
# Pages
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/')
def landing():
    if 'user' in session:
        return redirect('/dashboard')
    return render_template('landing.html')


@app.route('/permissions')
def permissions_page():
    if 'user' not in session:
        return redirect('/')
    return render_template('permissions.html', user=session['user'])


@app.route('/dashboard')
def dashboard():
    if 'user' not in session:
        return redirect('/')
    return render_template('index.html', user=session['user'])


@app.route('/logout')
def logout():
    username = session.get('user', {}).get('username')
    if username:
        user_repo_registry.pop(username, None)
    session.pop('user', None)
    return redirect('/')


# ─────────────────────────────────────────────────────────────────────────────
# GitHub OAuth
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/login/github')
def github_login():
    """Send user to GitHub OAuth with all required scopes (auto-requested)."""
    scopes = ['repo', 'read:org', 'write:discussion', 'workflow', 'user:email']
    params = (
        f"client_id={GITHUB_CLIENT_ID}"
        f"&scope={' '.join(scopes)}"
        f"&allow_signup=true"
    )
    return redirect(f"https://github.com/login/oauth/authorize?{params}")


@app.route('/callback/github')
def github_callback():
    """Exchange OAuth code → token, store in session, redirect to /permissions."""
    code = request.args.get('code')
    if not code:
        return redirect('/?error=no_code')

    token_resp = requests.post(
        'https://github.com/login/oauth/access_token',
        headers={"Accept": "application/json"},
        data={"client_id": GITHUB_CLIENT_ID,
              "client_secret": GITHUB_CLIENT_SECRET,
              "code": code},
        timeout=10,
    )
    token_data   = token_resp.json()
    access_token = token_data.get('access_token')
    if not access_token:
        print(f"[OAuth] Token exchange failed: {token_data.get('error_description')}")
        return redirect('/?error=no_token')

    user_resp = requests.get(
        'https://api.github.com/user',
        headers=gh_headers(access_token),
        timeout=10,
    )
    if user_resp.status_code != 200:
        return redirect('/?error=user_fetch_failed')

    user_data = user_resp.json()
    username  = user_data.get('login')

    session['user'] = {
        'username':     username,
        'avatar':       user_data.get('avatar_url'),
        'name':         user_data.get('name') or username,
        'access_token': access_token,
        'id':           user_data.get('id'),
        'email':        user_data.get('email'),
        'repos':        [],   # will be filled by /api/discover-repos
    }
    authorized_users.add(username)
    print(f"[OAuth] ✓ {username} authenticated.")
    return redirect('/permissions')


# ─────────────────────────────────────────────────────────────────────────────
# API — Verify OAuth Scopes
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/api/verify-permissions', methods=['GET'])
def verify_permissions():
    """Check which OAuth scopes were actually granted by the user."""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    token = session['user'].get('access_token')
    if not token:
        return jsonify({'error': 'No access token'}), 401

    resp = requests.get(
        'https://api.github.com/user',
        headers=gh_headers(token),
        timeout=10,
    )
    if resp.status_code != 200:
        return jsonify({'error': 'Token validation failed'}), 401

    raw = resp.headers.get('X-OAuth-Scopes', '')
    granted  = [s.strip() for s in raw.split(',') if s.strip()]
    required = ['repo', 'read:org', 'write:discussion', 'workflow', 'user:email']

    def satisfied(needed):
        if needed in granted:
            return True
        # parent-scope check: admin:org satisfies read:org etc.
        parent = needed.split(':')[0]
        return any(g == parent or g.startswith(f"{parent}:") for g in granted)

    missing = [s for s in required if not satisfied(s)]
    return jsonify({
        'granted':     granted,
        'required':    required,
        'missing':     missing,
        'all_granted': len(missing) == 0,
    })


# ─────────────────────────────────────────────────────────────────────────────
# API — Auto-Discover All Repos  ◄── ZERO CONFIG
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/api/discover-repos', methods=['POST'])
def discover_repos():
    """
    Automatically discover every GitHub repository the logged-in user has
    access to — no TARGET_REPOS config required.

    Discovery sources (merged, deduplicated):
      1. /user/repos?affiliation=owner,collaborator,organization_member
         → All repos the user owns or is a collaborator on
      2. /user/orgs  → then /orgs/{org}/repos  for each org
         → All repos in orgs the user belongs to

    If TARGET_REPOS_OVERRIDE is set in .env, the result is FILTERED to only
    those repos (acts as a whitelist for orgs that want to restrict scope).

    Returns:
      { "repos": [ { full_name, private, url, permissions, description,
                      language, open_issues, stars, org, source } ] }
    """
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    token    = session['user'].get('access_token')
    username = session['user'].get('username')
    if not token:
        return jsonify({'error': 'No access token'}), 401

    repos_map: dict = {}  # full_name → repo dict

    # ── Source 1: user/repos (owner + collaborator + org_member) ─────────────
    page = 1
    while True:
        resp = requests.get(
            'https://api.github.com/user/repos',
            headers=gh_headers(token),
            params={
                'affiliation': 'owner,collaborator,organization_member',
                'visibility':  'all',
                'per_page':    100,
                'sort':        'pushed',
                'page':        page,
            },
            timeout=15,
        )
        if resp.status_code != 200:
            break
        batch = resp.json()
        if not batch:
            break
        for r in batch:
            repos_map[r['full_name']] = _normalize_repo(r, source='direct')
        if len(batch) < 100:
            break
        page += 1

    # ── Source 2: org repos (catches repos the above might miss) ─────────────
    orgs_resp = requests.get(
        'https://api.github.com/user/orgs',
        headers=gh_headers(token),
        params={'per_page': 100},
        timeout=10,
    )
    if orgs_resp.status_code == 200:
        for org in orgs_resp.json():
            org_login = org.get('login')
            if not org_login:
                continue
            op = 1
            while True:
                oresp = requests.get(
                    f'https://api.github.com/orgs/{org_login}/repos',
                    headers=gh_headers(token),
                    params={'type': 'all', 'per_page': 100, 'page': op},
                    timeout=15,
                )
                if oresp.status_code != 200:
                    break
                obatch = oresp.json()
                if not obatch:
                    break
                for r in obatch:
                    if r['full_name'] not in repos_map:
                        repos_map[r['full_name']] = _normalize_repo(r, source='org')
                if len(obatch) < 100:
                    break
                op += 1

    # ── Apply whitelist override ──────────────────────────────────────────────
    if TARGET_REPOS_OVERRIDE:
        repos_map = {k: v for k, v in repos_map.items() if k in TARGET_REPOS_OVERRIDE}

    # ── Filter: only repos where user has at least push (write) access ────────
    accessible = [r for r in repos_map.values()
                  if r['permissions'].get('push') or
                     r['permissions'].get('admin') or
                     r.get('owner_login', '').lower() == username.lower()]

    # Sort: own repos first, then by pushed_at
    accessible.sort(key=lambda r: (
        0 if r.get('owner_login', '').lower() == username.lower() else 1,
        r.get('pushed_at', '') or '',
    ), reverse=False)
    accessible.sort(key=lambda r: r.get('pushed_at', '') or '', reverse=True)

    # Store in session & global registry for scanner
    repo_names = [r['full_name'] for r in accessible]
    session['user']['repos'] = repo_names
    session.modified = True
    user_repo_registry[username] = repo_names

    print(f"[Discover] {username}: discovered {len(accessible)} repos "
          f"({'whitelist active' if TARGET_REPOS_OVERRIDE else 'all accessible'})")

    return jsonify({
        'repos':       accessible,
        'total':       len(accessible),
        'orgs_scanned': len(orgs_resp.json()) if orgs_resp.status_code == 200 else 0,
        'whitelisted': bool(TARGET_REPOS_OVERRIDE),
    })


def _normalize_repo(r: dict, source: str = 'direct') -> dict:
    """Normalize a GitHub repo API object into our standard shape."""
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
        'org':         r.get('organization', {}).get('login', '') if r.get('organization') else '',
        'source':      source,
        'fork':        r.get('fork', False),
        'archived':    r.get('archived', False),
    }


# ─────────────────────────────────────────────────────────────────────────────
# API — Auto-Provision (access verification & reporting)
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/api/auto-provision', methods=['POST'])
def auto_provision():
    """
    For every repo discovered by /api/discover-repos, verify the user's
    actual GitHub permission level using the API and report it.

    For repos where the user only has read access and the server PAT has
    admin rights, we attempt to upgrade them to push/collaborator access.

    Returns per-repo status: owner | admin | push | read | invited | error
    """
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    username = session['user'].get('username')
    token    = session['user'].get('access_token')
    repos    = session['user'].get('repos', [])

    if not repos:
        return jsonify({
            'all_provisioned': True,
            'results': [],
            'message': 'No repos discovered yet — call /api/discover-repos first.',
        })

    results   = []
    all_ok    = True
    server_tk = GITHUB_TOKEN   # server PAT for granting access where needed

    for full_repo in repos:
        result = _check_and_provision(full_repo, username, token, server_tk)
        results.append(result)
        if result['status'] == 'error':
            all_ok = False

    print(f"[Provision] {username}: {len(results)} repos, all_ok={all_ok}")
    return jsonify({'all_provisioned': all_ok, 'results': results})


def _check_and_provision(full_repo: str, username: str,
                          user_token: str, server_token: str) -> dict:
    """Check permission level for one repo; upgrade via server token if needed."""
    base = {'repo': full_repo, 'private': False,
            'url': f'https://github.com/{full_repo}'}

    hdrs = gh_headers(user_token)

    # Fetch the repo as the user to get their permission level
    resp = requests.get(
        f'https://api.github.com/repos/{full_repo}',
        headers=hdrs, timeout=10,
    )
    if resp.status_code == 404:
        return {**base, 'status': 'error', 'message': 'Repo not found or no access'}
    if resp.status_code != 200:
        return {**base, 'status': 'error',
                'message': f'GitHub API error (HTTP {resp.status_code})'}

    repo_data = resp.json()
    base['private'] = repo_data.get('private', False)
    base['url']     = repo_data.get('html_url', base['url'])

    perms  = repo_data.get('permissions', {})
    owner  = repo_data.get('owner', {}).get('login', '')

    if owner.lower() == username.lower():
        return {**base, 'status': 'owner', 'message': 'You own this repository'}

    if perms.get('admin'):
        return {**base, 'status': 'admin', 'message': 'Admin access confirmed'}

    if perms.get('push'):
        return {**base, 'status': 'push', 'message': 'Write access confirmed'}

    if perms.get('pull'):
        # User only has read — try to grant push via server token
        if server_token:
            grant = _grant_collaborator(full_repo, username, server_token)
            if grant:
                return {**base, **grant}
        return {**base, 'status': 'read',
                'message': 'Read-only access (no server token to upgrade)'}

    return {**base, 'status': 'error', 'message': 'Permission level unknown'}


def _grant_collaborator(full_repo: str, username: str, server_token: str) -> dict | None:
    """Use server PAT to grant push/collaborator access."""
    owner, repo_name = full_repo.split('/', 1)
    hdrs = gh_headers(server_token)

    r = requests.put(
        f'https://api.github.com/repos/{owner}/{repo_name}/collaborators/{username}',
        headers=hdrs,
        json={'permission': 'push'},
        timeout=10,
    )
    if r.status_code == 201:
        return {'status': 'invited', 'message': 'Collaborator invitation sent ✓'}
    if r.status_code == 204:
        return {'status': 'push', 'message': 'Write access confirmed'}
    if r.status_code == 422:
        return {'status': 'push', 'message': 'Already a member'}
    return None


# ─────────────────────────────────────────────────────────────────────────────
# API — PR Health Scan (uses session repos — zero config)
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/api/scan', methods=['POST'])
def trigger_scan():
    """Trigger a full PR health scan across all repos discovered for this user."""
    if 'user' not in session:
        # fall back to server token + TARGET_REPOS_OVERRIDE for unauthenticated calls
        scan_token = GITHUB_TOKEN
        repos      = TARGET_REPOS_OVERRIDE
    else:
        # Use the logged-in user's token — they already have repo access
        scan_token = session['user'].get('access_token', GITHUB_TOKEN)
        repos      = session['user'].get('repos', TARGET_REPOS_OVERRIDE)

    if not repos:
        return jsonify({'success': False, 'error': 'No repos discovered yet.'}), 400

    scanner = PRHealthScanner(scan_token, repos)
    results = scanner.scan_all_repos()
    _ingest_scan_results(results)
    socketio.emit('scan_complete', {'results': results})
    return jsonify({'success': True, 'results': results})


@app.route('/api/repos', methods=['GET'])
def list_repos():
    """Return the repos currently stored for this user session."""
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    repos = session['user'].get('repos', [])
    return jsonify({'repos': repos, 'total': len(repos)})


@app.route('/api/health', methods=['GET'])
def health_check():
    username = session.get('user', {}).get('username', 'anonymous')
    repos    = session.get('user', {}).get('repos', TARGET_REPOS_OVERRIDE)
    return jsonify({
        'status':    'ok',
        'service':   'Bob PR Health Scanner',
        'user':      username,
        'repos':     repos,
        'timestamp': datetime.now().isoformat(),
    })


# ─────────────────────────────────────────────────────────────────────────────
# PR Status Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _ingest_scan_results(results: list):
    for result in results:
        repo = result['repo']
        for pr in result.get('conflicting_prs', []):
            pr_id = f"{repo}#{pr['pr']}"
            pr_status_db[pr_id] = {
                'repo': repo, 'pr_number': pr['pr'],
                'title': pr['title'], 'url': pr['url'],
                'status': 'pending', 'type': 'merge_conflict',
                'timestamp': datetime.now().isoformat(),
            }
        for failure in result.get('workflow_failures', []):
            fid = f"{repo}#{failure['id']}"
            pr_status_db[fid] = {
                'repo': repo, 'workflow_name': failure['name'],
                'branch': failure['branch'], 'url': failure['html_url'],
                'status': 'pending', 'type': 'ci_failure',
                'timestamp': datetime.now().isoformat(),
            }


def get_all_data():
    active      = [p for p in pr_status_db.values() if p['status'] == 'pending']
    in_progress = [p for p in pr_status_db.values() if p['status'] == 'in_progress']
    failed      = [p for p in pr_status_db.values() if p['status'] == 'failed']
    resolved    = [p for p in pr_status_db.values() if p['status'] == 'resolved']
    return {
        'active': active, 'in_progress': in_progress,
        'failed': failed, 'resolved': resolved,
        'stats': {
            'total': len(pr_status_db), 'pending': len(active),
            'in_progress': len(in_progress), 'failed': len(failed),
            'resolved': len(resolved),
        }
    }


# ─────────────────────────────────────────────────────────────────────────────
# WebSocket Events
# ─────────────────────────────────────────────────────────────────────────────

@socketio.on('connect')
def handle_connect():
    print('WS: client connected')
    emit('update', get_all_data())


@socketio.on('disconnect')
def handle_disconnect():
    print('WS: client disconnected')


@socketio.on('request_update')
def handle_request_update():
    emit('update', get_all_data())


@socketio.on('update_status')
def handle_update_status(data):
    pr_id      = data.get('pr_id')
    new_status = data.get('status')
    if new_status in ('pending', 'in_progress', 'failed', 'resolved') and pr_id in pr_status_db:
        pr_status_db[pr_id]['status']     = new_status
        pr_status_db[pr_id]['updated_at'] = datetime.now().isoformat()
        socketio.emit('update', get_all_data())


# ─────────────────────────────────────────────────────────────────────────────
# Background Scanning Thread — scans all registered user repos continuously
# ─────────────────────────────────────────────────────────────────────────────

def background_scan():
    """
    Every SCAN_INTERVAL seconds, scan all repos in user_repo_registry.
    Uses GITHUB_TOKEN as the scan token (server PAT must have repo read access).
    New repos discovered from logins are automatically picked up.
    """
    interval = int(os.getenv('SCAN_INTERVAL', 300))
    while True:
        time.sleep(interval)
        if not user_repo_registry:
            continue

        # Collect unique repos across all registered users
        all_repos: set = set()
        for repos in user_repo_registry.values():
            all_repos.update(repos)

        if not all_repos or not GITHUB_TOKEN:
            continue

        print(f"[BG Scan] Scanning {len(all_repos)} repos across all users…")
        try:
            scanner = PRHealthScanner(GITHUB_TOKEN, list(all_repos))
            results = scanner.scan_all_repos()
            _ingest_scan_results(results)
            socketio.emit('update', get_all_data())
            print(f"[BG Scan] ✓ Complete. {len(pr_status_db)} total issues tracked.")
        except Exception as e:
            print(f"[BG Scan] Error: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    print("─" * 64)
    print("  Bob PR Health Scanner")
    if TARGET_REPOS_OVERRIDE:
        print(f"  Whitelist mode: {len(TARGET_REPOS_OVERRIDE)} repos")
        for r in TARGET_REPOS_OVERRIDE:
            print(f"    • {r}")
    else:
        print("  Auto-discovery mode: repos fetched from each user on login")
    print("  WebSocket: enabled")
    print("─" * 64)

    scan_thread = threading.Thread(target=background_scan, daemon=True)
    scan_thread.start()

    port = int(os.getenv('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=False)
