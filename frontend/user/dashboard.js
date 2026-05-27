document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menu-toggle');
    const navDrawer = document.getElementById('nav-drawer');

    if (menuToggle && navDrawer) {
        menuToggle.addEventListener('click', () => {
            navDrawer.classList.toggle('open');
        });

        document.addEventListener('click', (event) => {
            if (window.innerWidth <= 900 && !navDrawer.contains(event.target) && !menuToggle.contains(event.target)) {
                navDrawer.classList.remove('open');
            }
        });
    }

    const wsStatusText = document.querySelector('.status-text');
    const wsStatusDot = document.querySelector('.status-dot');
    const actionItems = document.getElementById('action-items-container');
    const tableBody = document.getElementById('my-pr-table-body');

    const updateConnectionStatus = (status, text) => {
        if (wsStatusDot) {
            wsStatusDot.className = `status-dot ${status}`;
        }
        if (wsStatusText) {
            wsStatusText.textContent = text;
        }
    };

    const renderEmptyActions = (message) => {
        if (!actionItems) {
            return;
        }

        actionItems.innerHTML = `
            <div class="empty-state inline-empty">
                <span class="material-icons-outlined">task_alt</span>
                <p>${escapeHtml(message)}</p>
            </div>
        `;
    };

    const renderEmptyPRs = (message) => {
        if (!tableBody) {
            return;
        }

        tableBody.innerHTML = `
            <tr class="empty-state-row">
                <td colspan="4">
                    <div class="empty-state">
                        <span class="material-icons-outlined empty-icon">commit</span>
                        <p>${escapeHtml(message)}</p>
                    </div>
                </td>
            </tr>
        `;
    };

    const handleDeveloperPayload = (payload = {}) => {
        const prs = Array.isArray(payload.my_prs) ? payload.my_prs : (Array.isArray(payload.prs) ? payload.prs : []);
        const actions = Array.isArray(payload.action_items) ? payload.action_items : [];

        if (actionItems) {
            if (!actions.length) {
                renderEmptyActions('You have no assigned merge conflicts or failing checks right now.');
            } else {
                actionItems.innerHTML = actions.map((item) => `
                    <article class="task-card ${escapeHtml(item.kind || '')}">
                        <strong>${escapeHtml(item.title || 'Action required')}</strong>
                        <p>${escapeHtml(item.description || '')}</p>
                    </article>
                `).join('');
            }
        }

        if (tableBody) {
            if (!prs.length) {
                renderEmptyPRs('No active PR health blockers are assigned to your GitHub account.');
            } else {
                tableBody.innerHTML = prs.map((pr) => `
                    <tr>
                        <td>${escapeHtml(pr.repo || '')}</td>
                        <td>
                            <div class="pr-title">${escapeHtml(pr.title || 'Untitled PR')}</div>
                            <div class="pr-meta">${escapeHtml(pr.number ? `#${pr.number}` : 'Pending event')}</div>
                        </td>
                        <td>${escapeHtml(pr.ci_status || 'Awaiting payload')}</td>
                        <td>${escapeHtml(pr.merge_health || 'Awaiting payload')}</td>
                    </tr>
                `).join('');
            }
        }
    };

    renderEmptyActions('Waiting for your workspace scan to finish...');
    renderEmptyPRs('Waiting for repository scan results...');
    updateConnectionStatus('connecting', 'Connecting...');

    if (window.io) {
        const socket = io(window.location.origin, { withCredentials: true, transports: ['websocket', 'polling'] });

        socket.on('connect', () => {
            updateConnectionStatus('connected', 'Live Sync');
            socket.emit('request_update');
        });

        socket.on('disconnect', () => {
            updateConnectionStatus('disconnected', 'Offline');
        });

        socket.on('update', (payload) => {
            handleDeveloperPayload(payload);
        });
    }

    window.handleDeveloperPayload = handleDeveloperPayload;
});

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
