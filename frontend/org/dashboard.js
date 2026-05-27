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
            wsStatusDot.className = `status-dot w-2 h-2 rounded-full ${status}`;
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
                <td colspan="5" class="py-16 text-center text-zinc-500">
                    <div class="flex flex-col items-center gap-3">
                        <span class="material-symbols-outlined text-3xl animate-spin text-zinc-600">sync</span>
                        <p class="font-medium">${message}</p>
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
            ensureEmptyState('No active PR health blockers detected across repositories.');
            return;
        }

        tableBody.innerHTML = prs.map((pr) => {
            const isFailing = pr.ci_status === 'Failed' || pr.ci_status === 'Failing';
            const hasConflict = pr.merge_health === 'Conflict' || pr.merge_health === 'Conflicting';

            const ciBadge = isFailing
                ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-500 border border-red-500/20"><span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>Failed</span>`
                : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Passing</span>`;

            const mergeBadge = hasConflict
                ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">Conflict</span>`
                : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-800 border border-border text-zinc-400">Healthy</span>`;

            return `
                <tr class="hover:bg-zinc-900/40 transition-colors">
                    <td class="py-4 px-4 font-mono text-zinc-300 font-medium">${escapeHtml(pr.repo || '')}</td>
                    <td class="py-4 px-4">
                        <div class="font-bold text-white">${escapeHtml(pr.title || 'Untitled PR')}</div>
                        <div class="text-xs text-zinc-500 mt-1 font-mono">${escapeHtml(pr.number ? `#${pr.number}` : 'Pending event')}</div>
                    </td>
                    <td class="py-4 px-4 font-semibold text-zinc-400">${escapeHtml(pr.author || 'Pending event')}</td>
                    <td class="py-4 px-4">${ciBadge}</td>
                    <td class="py-4 px-4">${mergeBadge}</td>
                </tr>
            `;
        }).join('');
    };

    ensureEmptyState('Awaiting WebSocket payload from connected repositories...');
    updateConnectionStatus('connecting', 'Connecting...');

    // Resolve localhost / 127.0.0.1 connection to Flask backend on port 5000
    const wsUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
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