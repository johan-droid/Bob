// WebSocket connection
const socket = io('http://localhost:5000');

const connectionStatus = document.getElementById('connection-status');

// Connection status handlers
socket.on('connect', () => {
    console.log('Connected to Bob server');
    connectionStatus.className = 'connection-status connected';
    connectionStatus.querySelector('span').textContent = 'Connected';
    socket.emit('request_update');
});

socket.on('disconnect', () => {
    console.log('Disconnected from Bob server');
    connectionStatus.className = 'connection-status disconnected';
    connectionStatus.querySelector('span').textContent = 'Disconnected';
});

// Receive real-time updates
socket.on('update', (data) => {
    console.log('Received update:', data);
    updateUI(data);
});

// Update UI with data
function updateUI(data) {
    // Update stats
    if (data.stats) {
        document.getElementById('stat-pending').textContent = data.stats.pending;
        document.getElementById('stat-in-progress').textContent = data.stats.in_progress;
        document.getElementById('stat-failed').textContent = data.stats.failed;
        document.getElementById('stat-resolved').textContent = data.stats.resolved;
    }
    
    // Update active PRs
    renderPRList('active-prs', data.active, 'red', 'No active PRs awaiting resolution');
    
    // Update in-progress PRs
    renderPRList('in-progress-prs', data.in_progress, 'green', 'No PRs currently in progress');
    
    // Update failed PRs
    renderPRList('failed-prs', data.failed, 'red', 'No failed resolutions');
    
    // Update history
    renderPRList('history-prs', data.resolved, 'grey', 'No resolved PRs yet');
}

// Render PR list
function renderPRList(containerId, prs, dotColor, emptyMessage) {
    const container = document.getElementById(containerId);
    
    if (!prs || prs.length === 0) {
        container.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
        return;
    }
    
    container.innerHTML = prs.map(pr => `
        <div class="pr-card">
            <div class="status-dot ${dotColor}"></div>
            <div class="pr-content">
                <div class="pr-title">${escapeHtml(pr.title || pr.workflow_name || 'Untitled')}</div>
                <div class="pr-meta">
                    ${escapeHtml(pr.repo)} • ${pr.type === 'merge_conflict' ? 'PR #' + pr.pr_number : escapeHtml(pr.branch)}
                    ${pr.assigned_to ? '• ' + escapeHtml(pr.assigned_to) : ''}
                </div>
                <a href="${escapeHtml(pr.url)}" target="_blank" class="pr-link">View on GitHub →</a>
            </div>
            <span class="pr-badge ${pr.type === 'merge_conflict' ? 'conflict' : 'ci-failure'}">
                ${pr.type === 'merge_conflict' ? 'Merge Conflict' : 'CI Failure'}
            </span>
        </div>
    `).join('');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Request manual update
function requestUpdate() {
    socket.emit('request_update');
}

// Update PR status
function updatePRStatus(prId, status) {
    socket.emit('update_status', { pr_id: prId, status: status });
}
