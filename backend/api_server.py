from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import os
from dotenv import load_dotenv
from pr_health_scanner import PRHealthScanner
import json
from datetime import datetime
import threading
import time

load_dotenv()

app = Flask(__name__, static_folder='../frontend', template_folder='../frontend')
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
TARGET_REPOS = os.getenv("TARGET_REPOS", "").split(",")

# In-memory storage
pr_status_db = {}

@app.route('/')
def index():
    return render_template('index.html')

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
    
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
