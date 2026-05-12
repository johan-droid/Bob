from flask import Flask, jsonify, request, render_template, redirect, session, url_for
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import os
from dotenv import load_dotenv
from pr_health_scanner import PRHealthScanner
import json
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

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
TARGET_REPOS = os.getenv("TARGET_REPOS", "").split(",")
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")

# In-memory storage
pr_status_db = {}
authorized_users = set()

@app.route('/')
def landing():
    if 'user' in session:
        return redirect('/dashboard')
    return render_template('landing.html')

@app.route('/dashboard')
def dashboard():
    if 'user' not in session:
        return redirect('/')
    return render_template('index.html', user=session['user'])

@app.route('/login/github')
def github_login():
    return redirect(f'https://github.com/login/oauth/authorize?client_id={GITHUB_CLIENT_ID}&scope=user:email')

@app.route('/callback/github')
def github_callback():
    code = request.args.get('code')
    if not code:
        return redirect('/')
    
    # Exchange code for access token
    token_response = requests.post(
        'https://github.com/login/oauth/access_token',
        headers={'Accept': 'application/json'},
        data={
            'client_id': GITHUB_CLIENT_ID,
            'client_secret': GITHUB_CLIENT_SECRET,
            'code': code
        }
    )
    
    token_data = token_response.json()
    access_token = token_data.get('access_token')
    
    if not access_token:
        return redirect('/')
    
    # Get user info
    user_response = requests.get(
        'https://api.github.com/user',
        headers={'Authorization': f'token {access_token}'}
    )
    
    user_data = user_response.json()
    session['user'] = {
        'username': user_data.get('login'),
        'avatar': user_data.get('avatar_url'),
        'name': user_data.get('name')
    }
    
    authorized_users.add(user_data.get('login'))
    
    return redirect('/dashboard')

@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect('/')

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "service": "Bob PR Health Scanner"})

@app.route('/api/scan', methods=['POST'])
def trigger_scan():
    """Trigger a manual scan of all repositories."""
    scanner = PRHealthScanner(GITHUB_TOKEN, TARGET_REPOS)
    results = scanner.scan_all_repos()
    
    # Update PR status database
    for result in results:
        repo = result["repo"]
        for pr in result.get("conflicting_prs", []):
            pr_id = f"{repo}#{pr['pr']}"
            pr_status_db[pr_id] = {
                "repo": repo,
                "pr_number": pr['pr'],
                "title": pr['title'],
                "url": pr['url'],
                "status": "pending",
                "type": "merge_conflict",
                "timestamp": datetime.now().isoformat(),
                "assigned_to": "jules-google-lab"
            }
        
        for failure in result.get("workflow_failures", []):
            failure_id = f"{repo}#{failure['id']}"
            pr_status_db[failure_id] = {
                "repo": repo,
                "workflow_name": failure['name'],
                "branch": failure['branch'],
                "url": failure['html_url'],
                "status": "pending",
                "type": "ci_failure",
                "timestamp": datetime.now().isoformat(),
                "assigned_to": "jules-google-lab"
            }
    
    # Broadcast update via WebSocket
    socketio.emit('scan_complete', {'results': results})
    return jsonify({"success": True, "results": results})

def get_all_data():
    """Get all PR data organized by status."""
    active = [pr for pr in pr_status_db.values() if pr["status"] == "pending"]
    in_progress = [pr for pr in pr_status_db.values() if pr["status"] == "in_progress"]
    failed = [pr for pr in pr_status_db.values() if pr["status"] == "failed"]
    resolved = [pr for pr in pr_status_db.values() if pr["status"] == "resolved"]
    
    return {
        "active": active,
        "in_progress": in_progress,
        "failed": failed,
        "resolved": resolved,
        "stats": {
            "total": len(pr_status_db),
            "pending": len(active),
            "in_progress": len(in_progress),
            "failed": len(failed),
            "resolved": len(resolved)
        }
    }

@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('update', get_all_data())

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('request_update')
def handle_request_update():
    emit('update', get_all_data())

@socketio.on('update_status')
def handle_update_status(data):
    pr_id = data.get('pr_id')
    new_status = data.get('status')
    
    if new_status in ["pending", "in_progress", "failed", "resolved"] and pr_id in pr_status_db:
        pr_status_db[pr_id]["status"] = new_status
        pr_status_db[pr_id]["updated_at"] = datetime.now().isoformat()
        socketio.emit('update', get_all_data(), broadcast=True)

def background_scan():
    """Background task to scan repos periodically."""
    while True:
        time.sleep(300)  # Scan every 5 minutes
        try:
            scanner = PRHealthScanner(GITHUB_TOKEN, TARGET_REPOS)
            results = scanner.scan_all_repos()
            
            for result in results:
                repo = result["repo"]
                for pr in result.get("conflicting_prs", []):
                    pr_id = f"{repo}#{pr['pr']}"
                    if pr_id not in pr_status_db:
                        pr_status_db[pr_id] = {
                            "repo": repo,
                            "pr_number": pr['pr'],
                            "title": pr['title'],
                            "url": pr['url'],
                            "status": "pending",
                            "type": "merge_conflict",
                            "timestamp": datetime.now().isoformat(),
                            "assigned_to": "jules-google-lab"
                        }
                
                for failure in result.get("workflow_failures", []):
                    failure_id = f"{repo}#{failure['id']}"
                    if failure_id not in pr_status_db:
                        pr_status_db[failure_id] = {
                            "repo": repo,
                            "workflow_name": failure['name'],
                            "branch": failure['branch'],
                            "url": failure['html_url'],
                            "status": "pending",
                            "type": "ci_failure",
                            "timestamp": datetime.now().isoformat(),
                            "assigned_to": "jules-google-lab"
                        }
            
            socketio.emit('update', get_all_data(), broadcast=True)
        except Exception as e:
            print(f"Background scan error: {e}")

if __name__ == '__main__':
    print(f"Bob Server Starting...")
    print(f"Monitoring {len(TARGET_REPOS)} repositories")
    print(f"WebSocket enabled for real-time updates")
    
    # Start background scanning thread
    scan_thread = threading.Thread(target=background_scan, daemon=True)
    scan_thread.start()
    
    port = int(os.getenv('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=False)
