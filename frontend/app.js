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
document.addEventListener('DOMContentLoaded', () => {
    // Initial fetch to avoid waiting for WebSocket
    requestUpdate();
});

function requestUpdate() {
    apiFetch('/api/dashboard-data')
        .then(data => {
            allData = data;
            updateStats(data.stats);
            collectRepos(data);
            renderAll();
            renderRepos(data.repos || []);
        })
        .catch(err => console.warn('[Initial fetch] Failed:', err.message));
}

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
        el.innerHTML = '<div class="text-sm text-on-surface-variant bg-surface-container-low rounded-lg p-6 text-center border border-surface-variant border-dashed">Nothing here 🎉</div>';
        return;
    }
    el.innerHTML = items.map(pr => `
        <div class="bg-surface-container-lowest rounded-lg p-4 shadow-sm border border-surface-variant hover:shadow-md transition-shadow flex flex-col md:flex-row justify-between md:items-center gap-4" data-id="${pr.id}">
            <div class="flex items-start md:items-center gap-3">
                <span class="w-3 h-3 rounded-full mt-1.5 md:mt-0 ${pr.status === 'failed' ? 'bg-error' : pr.status === 'resolved' ? 'bg-tertiary-container' : pr.status === 'in_progress' ? 'bg-[#f9ab00]' : 'bg-primary'} shadow-sm"></span>
                <div class="flex flex-col">
                    <div class="font-medium text-on-surface">${escHtml(pr.title || 'Untitled')}</div>
                    <div class="text-xs text-on-surface-variant flex flex-wrap gap-2 mt-1">
                        <span class="font-medium">${escHtml(pr.repo)}</span>
                        ${pr.branch ? `<span>· ${escHtml(pr.branch)}</span>` : ''}
                        ${pr.pr_number ? `<span>· PR #${pr.pr_number}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="flex flex-wrap items-center gap-3">
                <a href="${escHtml(pr.url || '#')}" target="_blank" class="text-sm text-primary hover:text-primary-container font-medium flex items-center gap-1">View ↗</a>
                <span class="px-2 py-1 rounded bg-surface-container text-on-surface-variant text-xs font-medium">${pr.type === 'merge_conflict' ? '⚡ Conflict' : '🔧 CI'}</span>
                <select class="py-1 px-2 border border-outline-variant rounded bg-surface-container-lowest text-xs outline-none cursor-pointer" onchange="setStatus(${pr.id}, this.value)">
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
        el.innerHTML = '<div class="text-sm text-on-surface-variant bg-surface-container-low rounded-lg p-6 text-center border border-surface-variant border-dashed md:col-span-2 lg:col-span-3 xl:col-span-4">Not tracking any repositories yet.</div>';
        return;
    }

    el.innerHTML = repos.map(r => `
        <div class="bg-surface-container-lowest rounded-lg p-4 shadow-sm border border-surface-variant hover:shadow-md transition-shadow flex flex-col justify-between" style="opacity: ${r.is_active ? '1' : '0.5'}">
            <div class="flex justify-between items-start mb-4">
                <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full ${r.is_active ? 'bg-tertiary-fixed' : 'bg-outline'} shadow-sm"></span>
                    <h3 class="font-medium text-on-surface truncate pr-2" title="${escHtml(r.full_name)}">${escHtml(r.full_name)}</h3>
                </div>
            </div>
            <div class="flex flex-col gap-1 mb-4 text-sm text-on-surface-variant">
                <div class="flex justify-between"><span>Status:</span> <span class="bg-surface-container-high text-on-surface px-2 rounded-full text-xs border border-outline-variant">${r.is_active ? 'Scanning' : 'Ignored'}</span></div>
                <div class="flex justify-between"><span>Issues:</span> <span>${r.issue_count} total</span></div>
                <div class="flex justify-between"><span>Perms:</span> <span>${escHtml(r.permission || 'read')}</span></div>
                ${r.agent_permission ? `<div class="flex justify-between"><span>Agent:</span> <span class="${r.agent_permission === 'write' || r.agent_permission === 'admin' ? 'text-tertiary-container' : 'text-[#f9ab00]'} font-medium">${r.agent_permission === 'write' || r.agent_permission === 'admin' ? 'Active' : 'Observer'}</span></div>` : ''}
            </div>
            <div class="pt-3 border-t border-surface-variant flex justify-end items-center">
                <a href="https://github.com/${escHtml(r.full_name)}" target="_blank" class="text-sm text-primary hover:text-primary-container font-medium flex items-center gap-1">View ↗</a>
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
