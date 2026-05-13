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
    const icons = { success: 'check_circle', error: 'error', info: 'info', warning: 'warning' };
    const el = document.createElement('div');
    el.className = `card ${type}`;
    el.style.cssText = `
        background: white;
        border-radius: 16px;
        padding: 12px 20px;
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 280px;
        box-shadow: 0 12px 24px rgba(0,0,0,0.1);
        border-left: 6px solid var(--md-sys-color-${type === 'info' ? 'primary' : type === 'success' ? 'tertiary' : type});
        margin-bottom: 8px;
        pointer-events: auto;
    `;
    el.innerHTML = `
        <span class="material-symbols-outlined" style="color: var(--md-sys-color-${type === 'info' ? 'primary' : type === 'success' ? 'tertiary' : type});">${icons[type]}</span>
        <span class="text-body-md" style="flex: 1; font-weight: 500;">${escHtml(msg)}</span>
        <span class="material-symbols-outlined" style="cursor: pointer; font-size: 18px;" onclick="this.parentElement.remove()">close</span>`;
    document.getElementById('toast-container').prepend(el);
    setTimeout(() => { if(el.parentElement) el.remove(); }, duration);
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
    transports: ['websocket', 'polling']
});
const wsEl   = document.getElementById('ws-status');
const wsLbl  = wsEl?.querySelector('.text-label');
const wsDot  = wsEl?.querySelector('.status-dot');

socket.on('connect', () => {
    wsEl?.classList.replace('disconnected', 'connected');
    wsDot?.classList.replace('disconnected', 'connected');
    wsDot.style.background = 'var(--md-sys-color-tertiary)';
    if (wsLbl) wsLbl.textContent = 'Live Sync';
    socket.emit('request_update');
});

socket.on('disconnect', () => {
    wsEl?.classList.replace('connected', 'disconnected');
    wsDot?.classList.replace('connected', 'disconnected');
    wsDot.style.background = 'var(--md-sys-color-outline)';
    if (wsLbl) wsLbl.textContent = 'Offline';
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
    ['pending', 'in_progress', 'failed', 'resolved'].forEach(k => {
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
        el.innerHTML = '<div class="text-label" style="padding: 24px; text-align: center; background: var(--md-sys-color-surface-variant); border-radius: 16px;">Clean Slate.</div>';
        return;
    }
    el.innerHTML = items.map(pr => `
        <div class="card" style="display: flex; gap: 16px; align-items: center;">
            <span class="material-symbols-outlined" style="color: ${pr.status === 'failed' ? 'var(--md-sys-color-error)' : pr.status === 'resolved' ? 'var(--md-sys-color-tertiary)' : pr.status === 'in_progress' ? '#f9ab00' : 'var(--md-sys-color-primary)'}">${pr.status === 'failed' ? 'error' : pr.status === 'resolved' ? 'check_circle' : 'pending'}</span>
            <div style="flex: 1;">
                <div class="text-body-md" style="font-weight: 600;">${escHtml(pr.title || 'Untitled')}</div>
                <div style="font-size: 11px; color: var(--md-sys-color-on-surface-variant); margin-top: 2px;">${escHtml(pr.repo)} · ${pr.type === 'merge_conflict' ? 'Conflict' : 'CI Failure'}</div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <select class="input-field" style="width: auto; height: 28px; padding: 0 8px; font-size: 11px; border-radius: 8px;" onchange="setStatus(${pr.id}, this.value)">
                    ${['pending','in_progress','failed','resolved'].map(s => `<option value="${s}" ${pr.status===s?'selected':''}>${capitalize(s)}</option>`).join('')}
                </select>
                <a href="${escHtml(pr.url || '#')}" target="_blank" class="material-symbols-outlined" style="color: var(--md-sys-color-primary); text-decoration: none;">open_in_new</a>
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
        el.innerHTML = '<div class="text-label" style="grid-column: 1/-1; padding: 32px; text-align: center;">No repositories linked yet.</div>';
        return;
    }

    // Bento Logic: Repos with most issues or "admin" perms get larger tiles
    el.innerHTML = repos.map((r, idx) => {
        const isBig = r.issue_count > 0 || r.permissions_level === 'admin' || idx === 0;
        const spanClass = isBig ? 'span-2' : '';
        const icon = r.language === 'Python' ? 'terminal' : r.language === 'JavaScript' ? 'javascript' : 'code';
        
        return `
        <div class="bento-item ${spanClass}">
            <span class="material-symbols-outlined bento-bg-icon">${icon}</span>
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <div class="text-label" style="font-size: 10px; color: var(--md-sys-color-primary);">${r.language}</div>
                    <div class="text-title" style="margin-top: 4px; font-size: 18px;">${escHtml(r.full_name.split('/')[1])}</div>
                    <div style="font-size: 11px; color: var(--md-sys-color-on-surface-variant); margin-top: 2px;">${escHtml(r.full_name.split('/')[0])}</div>
                </div>
                <div style="background: ${r.is_active ? 'var(--md-sys-color-tertiary-container)' : 'var(--md-sys-color-surface-variant)'}; color: ${r.is_active ? 'var(--md-sys-color-on-tertiary-container)' : 'var(--md-sys-color-on-surface-variant)'}; padding: 4px 10px; border-radius: 8px; font-size: 10px; font-weight: 700;">
                    ${r.is_active ? 'MONITORING' : 'IDLE'}
                </div>
            </div>
            <div style="margin-top: auto; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <span class="material-symbols-outlined" style="font-size: 14px; color: var(--md-sys-color-error);">error</span>
                        <span style="font-size: 12px; font-weight: 600;">${r.issue_count}</span>
                    </div>
                    <div style="font-size: 12px; color: var(--md-sys-color-on-surface-variant);">${escHtml(r.permissions_level)}</div>
                </div>
                <a href="https://github.com/${escHtml(r.full_name)}" target="_blank" class="material-symbols-outlined" style="color: var(--md-sys-color-primary); text-decoration: none; font-size: 20px;">arrow_forward</a>
            </div>
        </div>
        `;
    }).join('');
}

// ── Status update ─────────────────────────────────────────────────────────────
async function setStatus(issueId, status) {
    try {
        await apiFetch(`/api/issues/${issueId}/status`, {
            method: 'POST',
            body: JSON.stringify({ status }),
        });
        showToast(`Status: ${capitalize(status)}`, 'success');
    } catch (e) {
        showToast(`Error: ${e.message}`, 'error');
    }
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = String(s || '');
    return d.innerHTML;
}
function capitalize(s) { return s.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()); }
