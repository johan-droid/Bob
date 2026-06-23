/* ── Dashboard app.js — Bob PR Health Scanner (Galaxy Edition) ──────────────── */

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

// ── Lifecycle ─────────────────────────────────────────────────────────────────
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
    const themeColors = { 
        success: 'var(--success)',
        error: 'var(--danger)',
        info: 'var(--accent)',
        warning: 'var(--warning)'
    };
    
    const el = document.createElement('div');
    el.className = `card ${type}`;
    el.style.cssText = `
        background: var(--bg-elevated);
        backdrop-filter: blur(12px);
        border-radius: 16px;
        padding: 14px 24px;
        display: flex;
        align-items: center;
        gap: 16px;
        min-width: 320px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        border: 1px solid var(--border);
        border-left: 6px solid ${themeColors[type]};
        margin-bottom: 12px;
        pointer-events: auto;
        animation: toast-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    el.innerHTML = `
        <span class="material-symbols-outlined" style="color: ${themeColors[type]};">${icons[type]}</span>
        <span style="flex: 1; font-weight: 600; color: var(--text-primary); font-size: 13px;">${escHtml(msg)}</span>
        <span class="material-symbols-outlined" style="cursor: pointer; font-size: 18px; color: var(--text-secondary);" onclick="this.parentElement.remove()">close</span>`;
    document.getElementById('toast-container').prepend(el);
    setTimeout(() => { 
        if(el.parentElement) {
            el.style.opacity = '0';
            el.style.transform = 'translateX(20px)';
            el.style.transition = 'all 0.3s ease';
            setTimeout(() => el.remove(), 300);
        }
    }, duration);
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
    wsDot?.classList.replace('disconnected', 'connected');
    if (wsLbl) wsLbl.textContent = 'LIVE SYNC';
    socket.emit('request_update');
});

socket.on('disconnect', () => {
    wsDot?.classList.replace('connected', 'disconnected');
    if (wsLbl) wsLbl.textContent = 'OFFLINE';
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
    all.forEach(i => allRepos.add(i.repo));
    // Filter selection logic can be added if needed
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
        el.innerHTML = '<div style="padding: 32px; text-align: center; color: var(--text-secondary); font-size: 13px; font-weight: 500; border: 1px dashed var(--border); border-radius: 16px;">System optimal. No pending tasks.</div>';
        return;
    }
    el.innerHTML = items.map(pr => {
        const statusColors = {
            failed: 'var(--danger)',
            resolved: 'var(--success)',
            in_progress: 'var(--warning)',
            pending: 'var(--accent)'
        };
        const color = statusColors[pr.status] || 'var(--accent)';
        
        return `
        <div class="card" style="display: flex; gap: 20px; align-items: center; border-left: 4px solid ${color};">
            <span class="material-symbols-outlined" style="color: ${color}; font-size: 24px;">
                ${pr.status === 'failed' ? 'report' : pr.status === 'resolved' ? 'check_circle' : pr.status === 'in_progress' ? 'hourglass_top' : 'emergency_home'}
            </span>
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 700; color: var(--text-primary); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escHtml(pr.title || 'Untitled Operation')}</div>
                <div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
                    ${escHtml(pr.repo)} · ${pr.type === 'merge_conflict' ? 'CONFLICT' : 'CI FAILURE'}
                </div>
            </div>
            <div style="display: flex; gap: 12px; align-items: center;">
                <select class="input-field" style="background: var(--bg-overlay); border: 1px solid var(--border); color: var(--text-primary); height: 32px; padding: 0 8px; font-size: 11px; border-radius: 10px; outline: none;" onchange="setStatus(${escHtml(pr.id)}, this.value)">
                    ${['pending','in_progress','failed','resolved'].map(s => `<option value="${s}" ${pr.status===s?'selected':''}>${capitalize(s)}</option>`).join('')}
                </select>
                <a href="${escHtml(pr.url || '#')}" target="_blank" rel="noopener noreferrer" class="material-symbols-outlined" style="color: var(--accent); text-decoration: none; font-size: 22px;">open_in_new</a>
            </div>
        </div>`;
    }).join('');
}

function renderRepos(repos) {
    const el = document.getElementById('repo-list');
    const badge = document.getElementById('repo-count-badge');
    if (!el || !badge) return;
    
    const activeRepos = repos.filter(r => r.is_active);
    badge.textContent = `${activeRepos.length} MONITORED`;

    if (!repos.length) {
        el.innerHTML = '<div class="text-label" style="grid-column: 1/-1; padding: 64px; text-align: center;">No integration links established.</div>';
        return;
    }

    el.innerHTML = repos.map((r, idx) => {
        const isBig = r.issue_count > 0 || r.permissions_level === 'admin' || idx === 0;
        const spanClass = isBig ? 'span-2' : '';
        const icon = r.language === 'Python' ? 'terminal' : r.language === 'JavaScript' ? 'javascript' : 'code';
        
        return `
        <div class="bento-item ${spanClass}">
            <span class="material-symbols-outlined bento-bg-icon">${icon}</span>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; z-index: 1;">
                <div>
                    <div style="font-family: var(--font-mono); font-size: 10px; color: var(--accent); font-weight: 700; letter-spacing: 1px;">${escHtml(r.language) || 'UNKNOWN'}</div>
                    <div class="text-title" style="margin-top: 6px; font-size: 20px; color: var(--text-primary);">${escHtml(r.full_name.split('/')[1])}</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px; font-weight: 500;">${escHtml(r.full_name.split('/')[0])}</div>
                </div>
                <div style="background: ${r.is_active ? 'var(--success-muted)' : 'var(--bg-overlay)'}; color: ${r.is_active ? 'var(--success)' : 'var(--text-secondary)'}; padding: 6px 12px; border-radius: 10px; font-size: 10px; font-weight: 800; border: 1px solid ${r.is_active ? 'var(--border-hover)' : 'var(--border)'};">
                    ${r.is_active ? 'MONITORED' : 'IDLE'}
                </div>
            </div>
            <div style="margin-top: auto; display: flex; justify-content: space-between; align-items: center; z-index: 1;">
                <div style="display: flex; gap: 16px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span class="material-symbols-outlined" style="font-size: 16px; color: var(--danger);">report</span>
                        <span style="font-size: 14px; font-weight: 700; color: var(--text-primary);">${escHtml(r.issue_count)}</span>
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${escHtml(r.permissions_level)}</div>
                </div>
                <a href="https://github.com/${escHtml(r.full_name)}" target="_blank" rel="noopener noreferrer" class="material-symbols-outlined" style="color: var(--accent); text-decoration: none; font-size: 24px; transition: transform 0.3s ease;">arrow_right_alt</a>
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
        showToast(`Status updated to ${capitalize(status)}`, 'success');
    } catch (e) {
        showToast(`Update failed: ${e.message}`, 'error');
    }
}

// ── Search ────────────────────────────────────────────────────────────────────
document.getElementById('search-input')?.addEventListener('input', (e) => {
    activeFilters.search = e.target.value.toLowerCase();
    renderAll();
});

// ── Utils ─────────────────────────────────────────────────────────────────────
function escHtml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function capitalize(s) { return s.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()); }
