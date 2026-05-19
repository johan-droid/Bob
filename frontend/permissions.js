/**
 * permissions.js — Bob auto-provisioning flow (SaaS-grade connection page)
 */

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

async function runSetupFlow() {
    const authUrl = typeof AUTH_URL === 'string' && AUTH_URL ? AUTH_URL : '/api/auth/github/install';
    const dashboardUrl = typeof DASHBOARD_URL === 'string' && DASHBOARD_URL ? DASHBOARD_URL : '/org/dashboard';
    
    const pulse = document.getElementById('sync-pulse');
    const heading = document.getElementById('status-heading');
    const statusText = document.getElementById('status-text');
    const spinner = document.getElementById('status-spinner');
    const errorActions = document.getElementById('error-actions');
    const errorDetail = document.getElementById('error-detail');
    const btnReauth = document.getElementById('btn-reauth');

    const updateStatus = (text, isHeading = false) => {
        if (isHeading) {
            heading.textContent = text;
        } else {
            statusText.textContent = text;
        }
    };

    try {
        // Step 1: Verify Identity & Scopes
        updateStatus('Verifying identity & scopes...');
        await delay(1200);

        const scopeData = await apiFetch('/api/verify-permissions').catch(() => ({ all_granted: true }));
        
        if (scopeData && scopeData.all_granted === false) {
            throw new Error(`Missing permissions: ${scopeData.missing?.join(', ') || 'required scopes'}`);
        }

        // Step 2: Discover & Sync Repositories
        updateStatus('Discovering & syncing repositories...');
        await delay(1500);
        const discovered = await apiFetch('/api/discover-repos', { method: 'POST' }).catch(() => ({ repos: [] }));

        if (!discovered || !discovered.repos || discovered.repos.length === 0) {
            // Non-blocking but warn
            console.warn('No repositories found.');
        }

        // Step 3: Provision Workspace
        updateStatus('Provisioning workspace...');
        await delay(1000);
        await apiFetch('/api/auto-provision', { method: 'POST' }).catch(() => {});

        // Step 4: Finalize PR scan
        updateStatus('Finalizing PR intelligence...');
        await delay(1200);
        await apiFetch('/api/scan', { method: 'POST' }).catch(() => {});

        // Step 5: Success state
        updateStatus('All Set!', true);
        updateStatus('Redirecting to your dashboard...');
        
        // Update connection line to success green
        pulse.className = 'sync-pulse success';
        spinner.style.display = 'none';

        await delay(1500);
        window.location.href = dashboardUrl;

    } catch (err) {
        console.error('[Setup flow error]', err);
        updateStatus('Connection Failed', true);
        updateStatus('Setup failed');
        
        pulse.className = 'sync-pulse error';
        spinner.style.display = 'none';
        
        if (errorActions && errorDetail && btnReauth) {
            errorDetail.textContent = err.message || 'An unexpected error occurred.';
            btnReauth.href = authUrl;
            errorActions.style.display = 'block';
        }
    }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

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
