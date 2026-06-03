document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menu-toggle');
    const navDrawer = document.getElementById('nav-drawer');
    const saveButton = document.getElementById('global-save-btn');
    const syncButton = document.getElementById('force-sync-btn');
    const syncStatusBox = document.getElementById('sync-info-box');
    const reposGrid = document.getElementById('repos-grid');

    const inputs = [
        document.getElementById('slack-webhook'),
        document.getElementById('discord-webhook'),
        document.getElementById('rule-label-conflict'),
        document.getElementById('rule-tag-author'),
    ].filter(Boolean);

    const snapshotState = () => ({
        slackWebhook: document.getElementById('slack-webhook')?.value || '',
        discordWebhook: document.getElementById('discord-webhook')?.value || '',
        autoLabelConflict: document.getElementById('rule-label-conflict')?.checked || false,
        tagAuthorOnFail: document.getElementById('rule-tag-author')?.checked || false,
    });

    let initialState = snapshotState();
    let currentSettings = {};

    const setSaveState = () => {
        const isDirty = JSON.stringify(snapshotState()) !== JSON.stringify(initialState);
        if (saveButton) {
            saveButton.disabled = !isDirty;
        }
    };

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

    inputs.forEach((input) => {
        input.addEventListener('input', setSaveState);
        input.addEventListener('change', setSaveState);
    });

    const loadSettings = async () => {
        try {
            const resp = await fetch('/api/app-state');
            if (!resp.ok) {
                if (resp.status === 401) { window.location.href = '/'; return; }
                throw new Error(`HTTP ${resp.status}`);
            }
            const appState = await resp.json();
            const data = appState.settings || {};
            const meta = appState.meta || {};
            const dashboard = appState.dashboard || {};
            const repos = dashboard.repos || [];

            currentSettings = data;

            const slackInput = document.getElementById('slack-webhook');
            const discordInput = document.getElementById('discord-webhook');
            const conflictCheckbox = document.getElementById('rule-label-conflict');
            const authorCheckbox = document.getElementById('rule-tag-author');

            if (slackInput) slackInput.value = data.slack_webhook || '';
            if (discordInput) discordInput.value = data.discord_webhook || '';
            if (conflictCheckbox) conflictCheckbox.checked = data.auto_label_conflict ?? true;
            if (authorCheckbox) authorCheckbox.checked = data.tag_author_on_fail ?? false;

            // Sync Status UI update
            if (syncStatusBox) {
                const statusLine = syncStatusBox.querySelector('strong');
                const detailLine = syncStatusBox.querySelector('span');
                const syncIcon = syncStatusBox.querySelector('.material-symbols-outlined');
                if (meta.active_repo_count > 0) {
                    if (statusLine) statusLine.textContent = 'Synchronized';
                    if (detailLine) detailLine.textContent = `${meta.active_repo_count} repositories actively monitored.`;
                    if (syncIcon) {
                        syncIcon.textContent = 'sync';
                        syncIcon.className = 'material-symbols-outlined sync-icon synced';
                    }
                } else {
                    if (statusLine) statusLine.textContent = 'Not Synchronized';
                    if (detailLine) detailLine.textContent = 'Awaiting GitHub App installation token payload.';
                    if (syncIcon) {
                        syncIcon.textContent = 'sync_problem';
                        syncIcon.className = 'material-symbols-outlined sync-icon';
                    }
                }
            }

            // Render Repos Grid
            renderReposGrid(repos);

            initialState = snapshotState();
            setSaveState();
        } catch (err) {
            console.error('Failed to load settings:', err);
            if (reposGrid) {
                reposGrid.innerHTML = `
                    <div class="repo-card">
                        <div class="section-copy">
                            <h3>Failed to load repository status.</h3>
                        </div>
                    </div>
                `;
            }
        }
    };

    const renderReposGrid = (repos) => {
        if (!reposGrid) return;
        if (!repos.length) {
            reposGrid.innerHTML = `
                <div class="repo-card">
                    <div class="section-copy">
                        <h3>No repositories connected yet.</h3>
                        <p>Discovered repositories will show up here.</p>
                    </div>
                </div>
            `;
            return;
        }

        reposGrid.innerHTML = repos.map((repo) => {
            const isActive = repo.is_active;
            const statusBadge = isActive
                ? `<span class="badge badge-success">Active</span>`
                : `<span class="badge badge-neutral">Paused</span>`;

            return `
                <div class="repo-card">
                    <div class="repo-head">
                        <div>
                            <h3>${escapeHtml(repo.full_name || '')}</h3>
                            <p>${escapeHtml(repo.language || 'Unknown language')}</p>
                            </div>
                            ${statusBadge}
                        </div>
                    <div class="repo-meta">
                        <span>Open Risks: <strong>${repo.issue_count ?? 0}</strong></span>
                        <span class="repo-permission">${escapeHtml(repo.permission || 'read')}</span>
                    </div>
                    <div class="repo-actions">
                        <span>Synced ${repo.last_synced ? 'recently' : 'never'}</span>
                        <button type="button" class="btn btn-outline btn-sm toggle-monitor-btn" data-repo="${escapeHtml(repo.full_name || '')}" data-active="${isActive}">
                            ${isActive ? 'Pause' : 'Resume'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Wire up Pause/Resume buttons
        document.querySelectorAll('.toggle-monitor-btn').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                const repoName = btn.getAttribute('data-repo');
                const isActive = btn.getAttribute('data-active') === 'true';
                btn.disabled = true;
                btn.textContent = isActive ? 'Pausing...' : 'Resuming...';
                await toggleRepoMonitoring(repoName, isActive);
            });
        });
    };

    const toggleRepoMonitoring = async (repoName, currentlyActive) => {
        try {
            const excluded = new Set(currentSettings.excluded_repos || []);
            if (currentlyActive) {
                excluded.add(repoName);
            } else {
                excluded.delete(repoName);
            }

            const csrfRes = await fetch('/api/csrf-token');
            const csrfData = await csrfRes.json();
            const csrfToken = csrfData.csrf_token;

            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({
                    excluded_repos: Array.from(excluded)
                })
            });

            if (response.ok) {
                await loadSettings();
            } else {
                alert('Failed to update repository monitoring status.');
                await loadSettings();
            }
        } catch (err) {
            console.error(err);
            alert('An error occurred during state toggle.');
            await loadSettings();
        }
    };

    saveButton.addEventListener('click', async () => {
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';

        const state = snapshotState();
        const payload = {
            slack_webhook: state.slackWebhook,
            discord_webhook: state.discordWebhook,
            auto_label_conflict: state.autoLabelConflict,
            tag_author_on_fail: state.tagAuthorOnFail
        };

        try {
            const csrfRes = await fetch('/api/csrf-token');
            const csrfData = await csrfRes.json();
            const csrfToken = csrfData.csrf_token;

            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                initialState = snapshotState();
                saveButton.textContent = 'Saved';
                window.setTimeout(() => {
                    setSaveState();
                }, 1200);
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to save settings.');
                setSaveState();
            }
        } catch (err) {
            console.error(err);
            alert('An error occurred while saving settings.');
            setSaveState();
        }
    });

    syncButton.addEventListener('click', async () => {
        const original = syncButton.textContent;
        syncButton.disabled = true;
        syncButton.textContent = 'Syncing...';

        if (syncStatusBox) {
            const statusLine = syncStatusBox.querySelector('strong');
            const detailLine = syncStatusBox.querySelector('span');
            if (statusLine) statusLine.textContent = 'Sync Requested';
            if (detailLine) detailLine.textContent = 'Scanning repositories...';
        }

        try {
            const csrfRes = await fetch('/api/csrf-token');
            const csrfData = await csrfRes.json();
            const csrfToken = csrfData.csrf_token;

            // Step 1: Discover Repos (triggers sync of repository catalog)
            const discoverRes = await fetch('/api/discover-repos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                }
            });

            // Step 2: Trigger PR scan
            const scanRes = await fetch('/api/scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                }
            });

            if (discoverRes.ok && scanRes.ok) {
                await loadSettings();
                if (syncStatusBox) {
                    const statusLine = syncStatusBox.querySelector('strong');
                    const detailLine = syncStatusBox.querySelector('span');
                    if (statusLine) statusLine.textContent = 'Synchronized';
                    if (detailLine) detailLine.textContent = 'Repository and PR scan complete.';
                }
            } else {
                if (syncStatusBox) {
                    const statusLine = syncStatusBox.querySelector('strong');
                    const detailLine = syncStatusBox.querySelector('span');
                    if (statusLine) statusLine.textContent = 'Sync Failed';
                    if (detailLine) detailLine.textContent = 'Discovery or Scan request failed.';
                }
            }
        } catch (err) {
            console.error(err);
            if (syncStatusBox) {
                const statusLine = syncStatusBox.querySelector('strong');
                const detailLine = syncStatusBox.querySelector('span');
                if (statusLine) statusLine.textContent = 'Sync Error';
                if (detailLine) detailLine.textContent = 'An error occurred during sync.';
            }
        } finally {
            window.setTimeout(() => {
                syncButton.disabled = false;
                syncButton.textContent = original;
            }, 2000);
        }
    });

    const deleteBtn = document.getElementById('delete-account-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (!confirm("Are you sure you want to permanently delete your account and all associated repository metadata? This action cannot be undone.")) {
                return;
            }
            try {
                deleteBtn.disabled = true;
                deleteBtn.textContent = 'Deleting...';
                
                const csrfRes = await fetch('/api/csrf-token');
                const csrfData = await csrfRes.json();
                const csrfToken = csrfData.csrf_token;

                const response = await fetch('/api/account/delete', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    }
                });

                if (response.ok) {
                    window.location.href = '/';
                } else {
                    const data = await response.json();
                    alert(data.error || 'Failed to delete account.');
                    deleteBtn.disabled = false;
                    deleteBtn.textContent = 'Delete Account';
                }
            } catch (err) {
                console.error(err);
                alert('An error occurred while deleting your account.');
                deleteBtn.disabled = false;
                deleteBtn.textContent = 'Delete Account';
            }
        });
    }

    // Initial load
    loadSettings();
});

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
