/* ── Dashboard app.js — Bob PR Health Scanner ─────────────────────────────── */

// ── CSRF token ────────────────────────────────────────────────────────────────
const CSRF_TOKEN = document.querySelector('meta[name="csrf-token"]')?.content || '';

async function apiFetch(url, opts = {}) {
    const resp = await fetch(url, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': CSRF_TOKEN,
            ...(opts.headers || {}),
        },
        credentials: 'same-origin',
    });
    if (!resp.ok) {
        if (resp.status === 401) { window.location.href = '/'; return; }
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
    }
    return resp.json();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 4000) {
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-msg">${escHtml(msg)}</span>
        <span class="toast-close" onclick="this.parentElement.remove()">✕</span>`;
    document.getElementById('toast-container').prepend(el);
    setTimeout(() => el.remove(), duration);
}

// ── State ─────────────────────────────────────────────────────────────────────
let allData   = { pending: [], in_progress: [], failed: [], resolved: [], stats: {} };
let allRepos  = new Set();
let activeFilters = { repo: '', type: '', search: '' };

// ── WebSocket ─────────────────────────────────────────────────────────────────
const wsUrl  = window.location.hostname === 'localhost'
    ? 'http://localhost:5000' : window.location.origin;
const socket = io(wsUrl, { 
    withCredentials: true,
    transports: ['websocket', 'polling'],
    upgrade: true
});
const wsEl   = document.getElementById('ws-status');
const wsDot  = wsEl?.querySelector('.ws-dot');
const wsLbl  = wsEl?.querySelector('.ws-label');

socket.on('connect', () => {
    wsEl?.classList.replace('disconnected', 'connected');
    if (wsLbl) wsLbl.textContent = 'Live';
    socket.emit('request_update');
});

socket.on('disconnect', () => {
    wsEl?.classList.replace('connected', 'disconnected');
    if (wsLbl) wsLbl.textContent = 'Offline';
    showToast('Lost connection — retrying…', 'warning');
    setTimeout(() => socket.connect(), 5000);
});

socket.on('connect_error', (err) => {
    console.warn('[WS] Connection error:', err.message);
    wsEl?.classList.replace('connected', 'disconnected');
    if (wsLbl) wsLbl.textContent = 'Reconnecting...';
    setTimeout(() => socket.connect(), 5000);
});

socket.on('update', (data) => {
    allData = data;
    updateStats(data.stats);
    collectRepos(data);
    renderAll();
    renderRepos(data.repos || []);
});

// ── Stats ─────────────────────────────────────────────────────────────────────
function updateStats(stats = {}) {
    ['pending', 'in_progress', 'failed', 'resolved', 'total'].forEach(k => {
        const el = document.getElementById(`stat-${k}`);
        if (el) el.textContent = stats[k] ?? 0;
    });
}

// ── Repo filter population ────────────────────────────────────────────────────
function collectRepos(data) {
    const all = [...(data.pending||[]), ...(data.in_progress||[]),
                 ...(data.failed||[]), ...(data.resolved||[])];
    const sel = document.getElementById('repo-filter');
    if (!sel) return;
    all.forEach(i => allRepos.add(i.repo));
    const current = sel.value;
    sel.innerHTML = '<option value="">All Repos</option>';
    [...allRepos].sort().forEach(r => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = r;
        if (r === current) opt.selected = true;
        sel.appendChild(opt);
    });
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderAll() {
    renderList('active-prs',      filter(allData.pending     || []));
    renderList('in-progress-prs', filter(allData.in_progress || []));
    renderList('failed-prs',      filter(allData.failed      || []));
    renderList('history-prs',     filter(allData.resolved    || []));
}

function filter(items) {
    const { repo, type, search } = activeFilters;
    return items.filter(i =>
        (!repo   || i.repo === repo) &&
        (!type   || i.type === type) &&
        (!search || i.title?.toLowerCase().includes(search) ||
                    i.repo?.toLowerCase().includes(search)));
}

function renderList(containerId, items) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!items.length) {
        el.innerHTML = '<div class="pr-empty">Nothing here 🎉</div>';
        return;
    }
    el.innerHTML = items.map(pr => `
        <div class="pr-card" data-id="${pr.id}">
            <div class="pr-dot ${pr.status}"></div>
            <div class="pr-body">
                <div class="pr-title">${escHtml(pr.title || 'Untitled')}</div>
                <div class="pr-meta">
                    <span class="pr-repo">${escHtml(pr.repo)}</span>
                    ${pr.branch ? `<span>· ${escHtml(pr.branch)}</span>` : ''}
                    ${pr.pr_number ? `<span>· PR #${pr.pr_number}</span>` : ''}
                </div>
                <a href="${escHtml(pr.url || '#')}" target="_blank" class="pr-link">View on GitHub →</a>
            </div>
            <div class="pr-actions">
                <span class="pr-badge ${pr.type}">${pr.type === 'merge_conflict' ? '⚡ Conflict' : '🔧 CI'}</span>
                <select class="pr-status-select" onchange="setStatus(${pr.id}, this.value)">
                    ${['pending','in_progress','failed','resolved'].map(s =>
                        `<option value="${s}" ${pr.status===s?'selected':''}>${capitalize(s)}</option>`
                    ).join('')}
                </select>
            </div>
        </div>`).join('');
}

function renderRepos(repos) {
    const el = document.getElementById('repo-list');
    const badge = document.getElementById('repo-count-badge');
    if (!el || !badge) return;
    
    const activeRepos = repos.filter(r => r.is_active);
    badge.textContent = `${activeRepos.length} Active`;

    if (!repos.length) {
        el.innerHTML = '<div class="pr-empty">Not tracking any repositories yet.</div>';
        return;
    }

    el.innerHTML = repos.map(r => `
        <div class="pr-card" style="opacity: ${r.is_active ? '1' : '0.5'}">
            <div class="pr-dot ${r.is_active ? 'resolved' : 'pending'}"></div>
            <div class="pr-body">
                <div class="pr-title">${escHtml(r.full_name)}</div>
                <div class="pr-meta">
                    <span>${r.is_active ? 'Scanning' : 'Ignored'}</span>
                    <span>· ${r.issue_count} total issues</span>
                    ${r.permission ? `<span>· ${r.permission}</span>` : ''}
                </div>
            </div>
            <div class="pr-actions">
                <a href="https://github.com/${escHtml(r.full_name)}" target="_blank" class="pr-link" style="padding: 6px 12px; background: rgba(255,255,255,0.05); border-radius: 6px;">View ↗</a>
            </div>
        </div>
    `).join('');
}

// ── Status update ─────────────────────────────────────────────────────────────
async function setStatus(issueId, status) {
    try {
        await apiFetch(`/api/issues/${issueId}/status`, {
            method: 'POST',
            body: JSON.stringify({ status }),
        });
    } catch (e) {
        showToast(`Failed to update status: ${e.message}`, 'error');
    }
}

// ── Filter controls ───────────────────────────────────────────────────────────
document.getElementById('repo-filter')?.addEventListener('change', e => {
    activeFilters.repo = e.target.value; renderAll();
});
document.getElementById('type-filter')?.addEventListener('change', e => {
    activeFilters.type = e.target.value; renderAll();
});
document.getElementById('search-input')?.addEventListener('input', e => {
    activeFilters.search = e.target.value.toLowerCase(); renderAll();
});

function requestUpdate() { socket.emit('request_update'); }

// ── PWA push notifications ────────────────────────────────────────────────────
async function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    if (perm === 'granted') showToast('Notifications enabled!', 'success');
}

// Ask once on first visit
if (localStorage.getItem('notif_asked') !== '1') {
    setTimeout(() => {
        requestNotificationPermission();
        localStorage.setItem('notif_asked', '1');
    }, 3000);
}

// Show notification on new issues
socket.on('update', (data) => {
    const newPending = (data.pending || []).length;
    const oldPending = (allData.pending || []).length;
    if (newPending > oldPending && Notification.permission === 'granted') {
        new Notification('Bob — New PR Issue', {
            body: `${newPending - oldPending} new issue(s) detected`,
            icon: '/icons/icon-192.png',
        });
    }
});

// ── Service Worker registration ───────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(console.warn);
}

// ── Error query param handling ────────────────────────────────────────────────
const urlErr = new URLSearchParams(window.location.search).get('error');
if (urlErr) {
    const msgs = {
        invalid_state:    'Login failed: security check failed. Please try again.',
        no_code:          'GitHub did not return an auth code.',
        no_token:         'Token exchange failed. Check your OAuth app config.',
        user_fetch_failed:'Could not fetch your GitHub profile.',
    };
    showToast(msgs[urlErr] || `Auth error: ${urlErr}`, 'error', 8000);
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = String(s || '');
    return d.innerHTML;
}
function capitalize(s) { return s.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()); }
