document.addEventListener('DOMContentLoaded', () => {
    const wsStatusText = document.querySelector('.status-text');
    const wsStatusDot = document.querySelector('.status-dot');

    // KPI Elements
    const kpiConflicts = document.getElementById('kpi-conflicts');
    const kpiFailing = document.getElementById('kpi-failing');
    const kpiReady = document.getElementById('kpi-ready');

    // Status Sections
    const requiresActionContainer = document.getElementById('requires-action-container');
    const inProgressContainer = document.getElementById('in-progress-container');
    const readyContainer = document.getElementById('ready-container');

    // Inputs
    const searchInput = document.getElementById('pr-search');
    const repoFilter = document.getElementById('repo-filter');

    let lastPayload = null;

    const updateConnectionStatus = (status, text) => {
        if (wsStatusDot) wsStatusDot.className = `status-dot ${status}`;
        if (wsStatusText) wsStatusText.textContent = text;
    };

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    const timeAgo = (dateStr) => {
        if (!dateStr) return 'Unknown';
        const date = new Date(dateStr);
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        const days = Math.floor(hours / 24);
        return `${days} day${days !== 1 ? 's' : ''} ago`;
    };

    const isFailingCI = (pr) => {
        return pr.ci_status === 'Failed' || pr.ci_status === 'Failing' || (pr.type === 'ci_failure');
    };

    const isConflict = (pr) => {
        return pr.merge_health === 'Conflict' || pr.merge_health === 'Conflicting' || (pr.type === 'merge_conflict');
    };

    const isRequiresAction = (pr) => {
        return isConflict(pr) || isFailingCI(pr);
    };

    const isReady = (pr) => {
        return !isRequiresAction(pr) && (pr.status === 'resolved' || (!isFailingCI(pr) && !isConflict(pr) && pr.ci_status === 'Passing' && pr.merge_health === 'Healthy'));
    };

    const isInProgress = (pr) => {
        return !isRequiresAction(pr) && !isReady(pr);
    };

    const organizeData = (prs) => {
        const grouped = {
            requiresAction: {},
            inProgress: {},
            ready: {}
        };

        prs.forEach(pr => {
            const repo = pr.repo || 'Unknown Repository';
            let category = 'inProgress';

            if (isRequiresAction(pr)) {
                category = 'requiresAction';
            } else if (isReady(pr)) {
                category = 'ready';
            }

            if (!grouped[category][repo]) {
                grouped[category][repo] = [];
            }
            grouped[category][repo].push(pr);
        });

        // Sort within each repo
        for (const cat in grouped) {
            for (const repo in grouped[cat]) {
                grouped[cat][repo].sort((a, b) => {
                    // Conflicts first
                    if (isConflict(a) && !isConflict(b)) return -1;
                    if (!isConflict(a) && isConflict(b)) return 1;
                    // CI failures second
                    if (isFailingCI(a) && !isFailingCI(b)) return -1;
                    if (!isFailingCI(a) && isFailingCI(b)) return 1;
                    // Most recent
                    const dateA = new Date(a.updated_at || a.created_at || 0);
                    const dateB = new Date(b.updated_at || b.created_at || 0);
                    return dateB - dateA;
                });
            }
        }
        return grouped;
    };

    const createPRCard = (pr) => {
        const isFail = isFailingCI(pr);
        const isConf = isConflict(pr);

        let badgesHtml = '';
        if (isConf) {
            badgesHtml += `<span class="badge badge-danger">Merge conflict</span>`;
        }
        if (isFail) {
            badgesHtml += `<span class="badge badge-danger">CI failing</span>`;
        }
        if (!isConf && !isFail) {
             if(isReady(pr)) {
                 badgesHtml += `<span class="badge badge-success">Ready</span>`;
             } else {
                 badgesHtml += `<span class="badge badge-warning">Pending reviews</span>`;
             }
        }

        const authorName = pr.author || 'Unknown';
        const authorInitial = authorName.charAt(0).toUpperCase();

        return `
            <div class="pr-card" id="pr-${escapeHtml(pr.id)}">
                <div class="pr-card-header">
                    <div class="pr-title">${escapeHtml(pr.title || 'Untitled PR')}</div>
                    <div class="pr-badges">${badgesHtml}</div>
                </div>
                <div class="pr-card-meta">
                    <span class="pr-number">#${escapeHtml(pr.number || pr.pr_number || '?')}</span>
                    <span class="pr-author">
                        <span class="author-avatar">${escapeHtml(authorInitial)}</span>
                        ${escapeHtml(authorName)}
                    </span>
                    <span class="pr-branch">→ ${escapeHtml(pr.branch || 'main')}</span>
                </div>
                <div class="pr-card-footer">
                    <a href="${escapeHtml(pr.url || '#')}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline">View PR</a>
                    <button class="btn btn-sm btn-outline dismiss-btn" data-id="${escapeHtml(pr.id)}">Dismiss</button>
                </div>
            </div>
        `;
    };

    const createRepoGroup = (repoName, prs) => {
        const prListHtml = prs.map(createPRCard).join('');
        const isExpanded = document.querySelector(`.repo-group[data-repo="${escapeHtml(repoName)}"]`)?.classList.contains('expanded');
        const expandedClass = isExpanded !== false ? 'expanded' : ''; // default true initially if not explicitly false
        const ariaExpanded = isExpanded !== false ? 'true' : 'false';

        return `
            <div class="repo-group ${expandedClass}" data-repo="${escapeHtml(repoName)}">
                <button class="repo-header" aria-expanded="${ariaExpanded}">
                    <div class="repo-header-info">
                        <span class="material-symbols-outlined repo-icon">folder</span>
                        <span class="repo-name">${escapeHtml(repoName)}</span>
                        <span class="repo-count">${prs.length} issue${prs.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="repo-header-right">
                        <span class="repo-sync">Synced just now</span>
                        <span class="material-symbols-outlined expand-icon">expand_more</span>
                    </div>
                </button>
                <div class="repo-pr-list">
                    ${prListHtml}
                </div>
            </div>
        `;
    };

    const renderSection = (container, groupedByRepo, emptyMessage) => {
        if (!container) return;

        const repos = Object.keys(groupedByRepo);
        if (repos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-outlined">check_circle</span>
                    <p>${escapeHtml(emptyMessage)}</p>
                </div>
            `;
            return;
        }

        const html = repos.map(repo => createRepoGroup(repo, groupedByRepo[repo])).join('');
        container.innerHTML = html;
    };

    const attachEventListeners = () => {
        // Expand/Collapse
        document.querySelectorAll('.repo-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const group = header.closest('.repo-group');
                const isExpanded = group.classList.toggle('expanded');
                header.setAttribute('aria-expanded', isExpanded);
            });
        });

        // Dismiss
        document.querySelectorAll('.dismiss-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const prId = btn.getAttribute('data-id');
                const card = btn.closest('.pr-card');

                // Optimistic UI update
                card.style.display = 'none';

                // In a real app we'd call the API here.
                try {
                    // await fetch(`/api/pr/${prId}/dismiss`, { method: 'POST' });
                    card.remove();
                } catch(e) {
                    card.style.display = '';
                    console.error("Failed to dismiss", e);
                }
            });
        });
    };

    const renderDashboard = (groupedData) => {
        renderSection(requiresActionContainer, groupedData.requiresAction, '✨ No merge conflicts or failing checks!');
        renderSection(inProgressContainer, groupedData.inProgress, 'All PRs are either ready or in action review.');
        renderSection(readyContainer, groupedData.ready, 'Come back when PRs are clean and passing.');
        attachEventListeners();
    };

    const populateRepoFilter = (prs) => {
        if(!repoFilter) return;
        const currentVal = repoFilter.value;
        const repos = [...new Set(prs.map(pr => pr.repo || 'Unknown Repository'))].sort();

        repoFilter.innerHTML = '<option value="">All Repositories</option>' +
            repos.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');

        if (repos.includes(currentVal)) {
            repoFilter.value = currentVal;
        }
    };

    const handleUpdate = (payload = {}) => {
        lastPayload = payload;
        const stats = payload.stats || {};
        if (kpiConflicts) kpiConflicts.textContent = stats.conflicts ?? 0;
        if (kpiFailing) kpiFailing.textContent = stats.failing ?? 0;
        if (kpiReady) kpiReady.textContent = stats.ready ?? 0;

        let prs = Array.isArray(payload.prs) ? payload.prs : [];

        // Include pending issues from payload.pending as well for more comprehensive dashboard
        if(Array.isArray(payload.pending)) {
             payload.pending.forEach(p => {
                 if(!prs.find(existing => existing.id === p.id)) {
                     prs.push(p);
                 }
             });
        }

        populateRepoFilter(prs);

        // Filter
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const selectedRepo = repoFilter ? repoFilter.value : '';

        prs = prs.filter(pr => {
            if (selectedRepo && (pr.repo !== selectedRepo)) return false;
            if (searchTerm) {
                const t = (pr.title || '').toLowerCase();
                const a = (pr.author || '').toLowerCase();
                if (!t.includes(searchTerm) && !a.includes(searchTerm)) return false;
            }
            return true;
        });

        const grouped = organizeData(prs);
        renderDashboard(grouped);
    };

    // Filter event listeners
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (lastPayload) handleUpdate(lastPayload);
        });
    }

    if (repoFilter) {
        repoFilter.addEventListener('change', () => {
            if (lastPayload) handleUpdate(lastPayload);
        });
    }

    updateConnectionStatus('connecting', 'Connecting...');

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
            handleUpdate(payload);
        });
    }

    window.handleIncomingPRData = handleUpdate;
});
