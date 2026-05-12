/**
 * permissions.js — Bob auto-provisioning flow
 * ─────────────────────────────────────────────────────────────────────────
 * 4-phase zero-config setup on every login:
 *
 *  Phase 1 – Verify OAuth scopes (repo, read:org, write:discussion, etc.)
 *  Phase 2 – Auto-discover ALL repos the user has access to
 *             (personal + every org they belong to — no manual config)
 *  Phase 3 – Verify / report access level per discovered repo
 *  Phase 4 – Trigger an initial PR health scan & redirect to dashboard
 * ─────────────────────────────────────────────────────────────────────────
 */

/* ── Required OAuth scopes ─────────────────────────────────────────── */
const REQUIRED_SCOPES = [
    { id: 'repo',             scope: 'repo',             label: 'Repository Access' },
    { id: 'read_org',         scope: 'read:org',         label: 'Organization Membership' },
    { id: 'write_discussion', scope: 'write:discussion', label: 'Discussions' },
    { id: 'workflow',         scope: 'workflow',         label: 'GitHub Actions' },
    { id: 'user_email',       scope: 'user:email',       label: 'Email Address' },
];

/* ── Progress tracking ─────────────────────────────────────────────── */
let totalSteps     = REQUIRED_SCOPES.length + 2; // scopes + discover + provision
let completedSteps = 0;

/* ── Bootstrap ─────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    populateUserChip();
    runSetupFlow();
});

function populateUserChip() {
    if (typeof USER_DATA === 'undefined') return;
    const avatarEl = document.getElementById('user-avatar');
    const nameEl   = document.getElementById('user-name');
    if (avatarEl && USER_DATA.avatar)   avatarEl.src         = USER_DATA.avatar;
    if (nameEl)                         nameEl.textContent   = USER_DATA.name || USER_DATA.username || 'User';
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN FLOW
══════════════════════════════════════════════════════════════════════ */
async function runSetupFlow() {
    try {
        /* ── Phase 1: OAuth scopes ── */
        const scopeData = await apiFetch('/api/verify-permissions');
        await animateScopeChecks(scopeData);
        tick();

        if (!scopeData.all_granted) {
            showBanner('error', '🔒', 'Missing Permissions',
                `Please re-authorize to grant: ${scopeData.missing.join(', ')}`,
                '<a href="/login/github">Re-authorize →</a>');
            markError();
            showCTA(false, true);
            return;
        }

        /* ── Phase 2: Discover repos ── */
        const discovered = await runDiscovery();
        tick();

        if (!discovered || discovered.repos.length === 0) {
            showBanner('warning', '📭', 'No Repositories Found',
                'No repositories were found for your account. Try re-authorizing or check your org memberships.',
                '<a href="/login/github">Re-authorize →</a>');
            setProgress(80);
            showCTA(false, true);
            return;
        }

        /* ── Phase 3: Provision / verify access ── */
        const provision = await runProvision(discovered.repos);
        tick();

        /* ── Phase 4: Initial PR scan & finish ── */
        await runInitialScan();
        finishFlow(provision);

    } catch (err) {
        console.error('[Setup flow]', err);
        showBanner('error', '⚠️', 'Setup Error',
            err.message || 'An unexpected error occurred.',
            '<a href="/login/github">Retry →</a>');
        markError();
    }
}

/* ═══════════════════════════════════════════════════════════════════
   PHASE 1 — OAuth scopes
══════════════════════════════════════════════════════════════════════ */
async function animateScopeChecks(data) {
    const granted = data.granted || [];
    for (const s of REQUIRED_SCOPES) {
        await delay(260);
        const ok = granted.includes(s.scope)
            || granted.includes(s.scope.split(':')[0]);
        setScopeCard(s.id, ok);
    }
}

function setScopeCard(id, granted) {
    const card   = document.getElementById(`perm-${id}`);
    const status = document.getElementById(`status-${id}`);
    const text   = document.getElementById(`status-text-${id}`);
    if (!card) return;
    if (granted) {
        card.classList.add('state-success');
        status.className = 'perm-status success';
        status.innerHTML = svgCheck(16, 'var(--success)');
        text.textContent = 'Granted';
        text.style.color = 'var(--success)';
    } else {
        card.classList.add('state-error');
        status.className = 'perm-status error';
        status.innerHTML = svgX(16, 'var(--danger)');
        text.textContent = 'Missing';
        text.style.color = 'var(--danger)';
    }
}

/* ═══════════════════════════════════════════════════════════════════
   PHASE 2 — Auto-discover repos
══════════════════════════════════════════════════════════════════════ */
async function runDiscovery() {
    const container = document.getElementById('repos-container');

    // Show discovery loading state
    container.innerHTML = buildDiscoveryLoader();

    const data = await apiFetch('/api/discover-repos', { method: 'POST' });
    const repos = data.repos || [];

    // Update section label to show count
    const secLabel = document.getElementById('section-repo-label');
    if (secLabel) {
        secLabel.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
            </svg>
            Repositories Discovered
            <span style="background:rgba(99,102,241,.2);color:var(--accent2);padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;margin-left:6px;">${repos.length}</span>
            ${data.whitelisted ? '<span style="color:var(--warning);font-size:11px;margin-left:4px;">(whitelist active)</span>' : ''}
        `;
    }

    // Increase total steps to account for repos
    totalSteps = REQUIRED_SCOPES.length + 2 + repos.length;

    // Show all repo cards in "pending" state first
    container.innerHTML = '';
    if (repos.length === 0) {
        container.innerHTML = `<div class="repos-loading"><span>No accessible repositories found.</span></div>`;
    } else {
        for (const repo of repos) {
            container.appendChild(buildRepoCard(repo, 'pending'));
        }
    }

    return data;
}

function buildDiscoveryLoader() {
    return `
        <div class="repos-loading">
            <div class="repos-spinner"></div>
            <div style="flex:1">
                <div style="font-size:14px;font-weight:600;color:var(--text)">Discovering your repositories…</div>
                <div style="font-size:12px;color:var(--text2);margin-top:3px">Scanning personal repos + all org repos you belong to</div>
            </div>
        </div>
    `;
}

/* ═══════════════════════════════════════════════════════════════════
   PHASE 3 — Provision / verify access per repo
══════════════════════════════════════════════════════════════════════ */
async function runProvision(repos) {
    // Hit the backend to verify/grant access
    const data = await apiFetch('/api/auto-provision', { method: 'POST' });
    const results = data.results || [];

    let successCount = 0;

    for (const result of results) {
        await delay(200);
        updateRepoCard(result);
        if (['owner', 'admin', 'push', 'invited'].includes(result.status)) successCount++;
        tick();
    }

    return { successCount, total: results.length, allOk: data.all_provisioned };
}

/* ═══════════════════════════════════════════════════════════════════
   PHASE 4 — Initial PR health scan
══════════════════════════════════════════════════════════════════════ */
async function runInitialScan() {
    // Fire and don't block — scan happens in background
    apiFetch('/api/scan', { method: 'POST' }).catch(e =>
        console.warn('[Initial scan] Failed (non-blocking):', e.message));
    await delay(400); // small wait to let it kick off
}

/* ═══════════════════════════════════════════════════════════════════
   FINISH
══════════════════════════════════════════════════════════════════════ */
function finishFlow(provision) {
    const { successCount, total } = provision;

    setProgress(100);
    updateHeroSuccess();
    updateBreadcrumbDone();

    showBanner('success', '🚀',
        `${successCount} of ${total} repositories ready`,
        'PR health monitoring is active. Bob will continuously scan your repos. Redirecting to dashboard…',
        '<a href="/dashboard">Go Now →</a>');

    showCTA(true, false);

    // Auto-redirect after 4 s
    let countdown = 4;
    const cdEl = document.querySelector('#btn-dashboard');
    if (cdEl) {
        const tick = setInterval(() => {
            countdown--;
            if (cdEl) cdEl.innerHTML = `${svgGrid(18)} Opening Dashboard (${countdown}s)`;
            if (countdown <= 0) { clearInterval(tick); window.location.href = '/dashboard'; }
        }, 1000);
    } else {
        setTimeout(() => { window.location.href = '/dashboard'; }, 4000);
    }
}

/* ═══════════════════════════════════════════════════════════════════
   Repo card DOM helpers
══════════════════════════════════════════════════════════════════════ */
function buildRepoCard(repo, initialState) {
    const card = document.createElement('div');
    card.id    = `repo-card-${safeId(repo.full_name)}`;
    card.className = 'repo-card';

    const isPrivate  = repo.private;
    const isArchived = repo.archived;
    const isFork     = repo.fork;
    const langColor  = LANG_COLORS[repo.language] || '#6366f1';
    const openCount  = repo.open_issues || 0;
    const perm       = highestPerm(repo.permissions, repo.owner_login);

    card.innerHTML = `
        <div class="repo-left">
            <div class="repo-icon">${svgGit(16)}</div>
            <div style="flex:1;min-width:0;">
                <div class="repo-name">
                    <a href="${escHtml(repo.url)}" target="_blank" style="color:inherit;text-decoration:none;"
                       onmouseover="this.style.color='var(--accent2)'" onmouseout="this.style.color='inherit'">
                        ${escHtml(repo.full_name)}
                    </a>
                    ${isPrivate  ? '<span class="repo-pill private">Private</span>' : ''}
                    ${isArchived ? '<span class="repo-pill archived">Archived</span>' : ''}
                    ${isFork     ? '<span class="repo-pill fork">Fork</span>' : ''}
                </div>
                <div class="repo-meta">
                    ${repo.language !== 'Unknown' ? `<span style="display:flex;align-items:center;gap:4px"><span style="width:9px;height:9px;border-radius:50%;background:${langColor};display:inline-block"></span>${escHtml(repo.language)}</span>` : ''}
                    ${openCount > 0 ? `<span>⚠ ${openCount} open issues</span>` : ''}
                    <span style="color:var(--text3)">${permLabel(perm)}</span>
                </div>
            </div>
        </div>
        <div class="repo-status-wrap">
            <span class="repo-status-badge granting" id="repo-badge-${safeId(repo.full_name)}">
                <span class="mini-spin"></span> Verifying…
            </span>
        </div>
    `;
    return card;
}

function updateRepoCard(result) {
    const card  = document.getElementById(`repo-card-${safeId(result.repo)}`);
    const badge = document.getElementById(`repo-badge-${safeId(result.repo)}`);
    if (!card || !badge) return;

    const MAP = {
        owner:   { state: 'success', cls: 'granted',  icon: '👑', label: 'Owner' },
        admin:   { state: 'success', cls: 'granted',  icon: '🛡',  label: 'Admin' },
        push:    { state: 'success', cls: 'already',  icon: '✅',  label: 'Write Access' },
        invited: { state: 'info',    cls: 'granting', icon: '📨',  label: 'Invitation Sent' },
        read:    { state: 'warning', cls: 'skipped',  icon: '👁',  label: 'Read Only' },
        error:   { state: 'error',   cls: 'error',    icon: '✗',   label: 'Error' },
    };

    const cfg = MAP[result.status] || { state: 'info', cls: 'pending', icon: '?', label: result.status };
    card.classList.add(`state-${cfg.state}`);
    badge.className  = `repo-status-badge ${cfg.cls}`;
    badge.innerHTML  = `${cfg.icon} ${escHtml(result.message || cfg.label)}`;
}

/* ═══════════════════════════════════════════════════════════════════
   Progress bar
══════════════════════════════════════════════════════════════════════ */
function tick() {
    completedSteps = Math.min(completedSteps + 1, totalSteps);
    const pct = Math.round((completedSteps / totalSteps) * 100);
    setProgress(Math.min(pct, 99));
}

function setProgress(pct) {
    const bar  = document.getElementById('progress-bar');
    const pctEl = document.getElementById('progress-pct');
    if (bar)   bar.style.width    = `${pct}%`;
    if (pctEl) pctEl.textContent  = `${pct}%`;
}

function markError() {
    const bar = document.getElementById('progress-bar');
    if (bar) { bar.style.background = 'var(--danger)'; bar.style.animation = 'none'; }
}

/* ═══════════════════════════════════════════════════════════════════
   Banner
══════════════════════════════════════════════════════════════════════ */
function showBanner(type, icon, title, sub, actionHtml) {
    const banner = document.getElementById('status-banner');
    banner.style.display = 'flex';
    banner.className     = `status-banner ${type}-banner`;
    document.getElementById('banner-icon').textContent   = icon;
    document.getElementById('banner-title').textContent  = title;
    document.getElementById('banner-sub').textContent    = sub;
    document.getElementById('banner-action').innerHTML   = actionHtml || '';
}

/* ═══════════════════════════════════════════════════════════════════
   Hero / breadcrumb state
══════════════════════════════════════════════════════════════════════ */
function updateHeroSuccess() {
    const inner = document.querySelector('.hero-icon-inner');
    const title = document.getElementById('hero-title');
    const sub   = document.getElementById('hero-subtitle');
    if (inner) inner.classList.add('success-glow');
    if (title) {
        title.textContent = 'All Set!';
        title.style.background = 'linear-gradient(135deg,#10b981,#34d399)';
        title.style.webkitBackgroundClip = 'text';
        title.style.webkitTextFillColor  = 'transparent';
    }
    if (sub) sub.innerHTML =
        'Repos discovered, access verified, PR scanning is live.<br><strong>Redirecting to your dashboard…</strong>';
}

function updateBreadcrumbDone() {
    const line2   = document.getElementById('crumb-line-2');
    const circle3 = document.getElementById('crumb-circle-3');
    const crumb3  = document.getElementById('crumb-3');
    if (line2)   line2.classList.add('active');
    if (circle3) { circle3.className = 'crumb-circle done'; circle3.innerHTML = svgCheck(12, 'white'); }
    if (crumb3)  { crumb3.className = 'crumb crumb-done'; }
}

/* ═══════════════════════════════════════════════════════════════════
   CTA
══════════════════════════════════════════════════════════════════════ */
function showCTA(success, showRetry) {
    const row      = document.getElementById('cta-row');
    const dashBtn  = document.getElementById('btn-dashboard');
    const retryBtn = document.getElementById('btn-retry');
    row.style.display = 'flex';
    if (!success && dashBtn) dashBtn.style.display = 'none';
    if (showRetry && retryBtn) retryBtn.style.display = 'inline-flex';
}

/* ═══════════════════════════════════════════════════════════════════
   Utilities
══════════════════════════════════════════════════════════════════════ */
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function safeId(str) { return (str || '').replace(/[^a-zA-Z0-9]/g, '_'); }

function escHtml(s) {
    return String(s || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function apiFetch(url, opts = {}) {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
    const headers = { 
        'Content-Type': 'application/json', 
        ...(opts.headers || {}) 
    };
    if (csrfToken) headers['X-CSRFToken'] = csrfToken;

    const resp = await fetch(url, {
        ...opts,
        headers
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status} on ${url}`);
    }
    return resp.json();
}

function highestPerm(perms, ownerLogin) {
    const user = (typeof USER_DATA !== 'undefined') ? USER_DATA.username : '';
    if (ownerLogin && user && ownerLogin.toLowerCase() === user.toLowerCase()) return 'owner';
    if (!perms) return 'read';
    if (perms.admin) return 'admin';
    if (perms.push)  return 'push';
    return 'read';
}

function permLabel(p) {
    const m = { owner: '👑 Owner', admin: '🛡 Admin', push: '✏️ Write', read: '👁 Read' };
    return m[p] || p;
}

/* ── Inline SVG helpers ─────────────────────────────────────────── */
function svgCheck(sz, col) {
    return `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
}
function svgX(sz, col) {
    return `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
}
function svgGit(sz) {
    return `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg>`;
}
function svgGrid(sz) {
    return `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`;
}

/* ── Language dot colours (GitHub standard) ─────────────────────── */
const LANG_COLORS = {
    JavaScript:'#f1e05a', TypeScript:'#2b7489', Python:'#3572A5', Go:'#00ADD8',
    Rust:'#dea584', Java:'#b07219', Ruby:'#701516', PHP:'#4F5D95',
    'C++':'#f34b7d', C:'#555555', 'C#':'#178600', Swift:'#F05138',
    Kotlin:'#A97BFF', Dart:'#00B4AB', HTML:'#e34c26', CSS:'#563d7c',
    Shell:'#89e051', Vue:'#41b883', Svelte:'#ff3e00', Dockerfile:'#384d54',
};
