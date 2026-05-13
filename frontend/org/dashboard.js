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
    const kpiConflicts = document.getElementById('kpi-conflicts');
    const kpiFailing = document.getElementById('kpi-failing');
    const kpiReady = document.getElementById('kpi-ready');
    const tableBody = document.getElementById('pr-table-body');

    const updateConnectionStatus = (status, text) => {
        if (wsStatusDot) {
            wsStatusDot.className = `status-dot ${status}`;
        }
        if (wsStatusText) {
            wsStatusText.textContent = text;
        }
    };

    const ensureEmptyState = (message) => {
        if (!tableBody) {
            return;
        }

        tableBody.innerHTML = `
            <tr class="empty-state-row">
                <td colspan="5">
                    <div class="empty-state">
                        <span class="material-icons-outlined empty-icon">sync</span>
                        <p>${message}</p>
                    </div>
                </td>
            </tr>
        `;
    };

    const handleIncomingPRData = (payload = {}) => {
        const stats = payload.stats || {};
        if (kpiConflicts) kpiConflicts.textContent = stats.conflicts ?? 0;
        if (kpiFailing) kpiFailing.textContent = stats.failing ?? 0;
        if (kpiReady) kpiReady.textContent = stats.ready ?? 0;

        if (!tableBody) {
            return;
        }

        const prs = Array.isArray(payload.prs) ? payload.prs : [];
        if (!prs.length) {
            ensureEmptyState('Awaiting WebSocket payload from connected repositories...');
            return;
        }

        tableBody.innerHTML = prs.map((pr) => `
            <tr>
                <td>${escapeHtml(pr.repo || '')}</td>
                <td>
                    <div class="pr-title">${escapeHtml(pr.title || 'Untitled PR')}</div>
                    <div class="pr-meta">${escapeHtml(pr.number ? `#${pr.number}` : 'Pending event')}</div>
                </td>
                <td>${escapeHtml(pr.author || 'Pending event')}</td>
                <td>${escapeHtml(pr.ci_status || 'Awaiting payload')}</td>
                <td>${escapeHtml(pr.merge_health || 'Awaiting payload')}</td>
            </tr>
        `).join('');
    };

    ensureEmptyState('Awaiting WebSocket payload from connected repositories...');
    updateConnectionStatus('connecting', 'Connecting...');

    const wsUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000'
        : window.location.origin;

    if (window.io) {
        const socket = io(wsUrl, { withCredentials: true, transports: ['websocket', 'polling'] });

        socket.on('connect', () => {
            updateConnectionStatus('connected', 'Live Sync');
            socket.emit('request_update');
        });

        socket.on('disconnect', () => {
            updateConnectionStatus('disconnected', 'Offline');
        });

        socket.on('update', (payload) => {
            handleIncomingPRData(payload);
        });
    }

    window.handleIncomingPRData = handleIncomingPRData;
});

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}