"use client";

import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { api, realtimeBaseUrl, type AppSettings, type AppState, type DashboardPayload, type IssueItem, type IssueStatus, type RepoItem } from '@/lib/api';

type Props = {
  mode: 'org' | 'user';
};

type LiveStatus = 'connecting' | 'connected' | 'disconnected';

const issueStatuses: IssueStatus[] = ['pending', 'in_progress', 'failed', 'resolved'];

function combineIssues(data: DashboardPayload) {
  return issueStatuses.flatMap((status) => (
    (data[status] || []).map((item) => ({ ...item, status: item.status || status }))
  ));
}

function formatStatus(status?: string) {
  return (status || 'pending').replace(/_/g, ' ');
}

function issueTone(issue: IssueItem) {
  if (issue.status === 'resolved') return 'success';
  if (issue.status === 'in_progress') return 'warning';
  if (issue.type === 'ci_failure' || issue.status === 'failed') return 'danger';
  return 'attention';
}

function issueLabel(issue: IssueItem) {
  if (issue.type === 'merge_conflict') return 'Merge conflict';
  if (issue.type === 'ci_failure') return 'CI failure';
  return 'PR risk';
}

function uniqueRepos(issues: IssueItem[]) {
  return new Set(issues.map((issue) => issue.repo).filter(Boolean)).size;
}

export function DashboardView({ mode }: Props) {
  const [state, setState] = useState<AppState>({});
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('connecting');
  const [showSettings, setShowSettings] = useState(false);

  const dashboard = state.dashboard || {};
  const settings = state.settings || {};
  const issues = useMemo(() => combineIssues(dashboard), [dashboard]);
  const repos = dashboard.repos || [];
  const openIssues = issues.filter((issue) => issue.status !== 'resolved');
  const mergeConflicts = openIssues.filter((issue) => issue.type === 'merge_conflict');
  const ciFailures = openIssues.filter((issue) => issue.type === 'ci_failure');
  const activeRepos = repos.filter((repo) => repo.is_active);
  const cleanRepos = activeRepos.filter((repo) => !repo.issue_count);
  const affectedRepoCount = uniqueRepos(openIssues);

  const refreshState = async (quiet = false) => {
    try {
      if (!quiet) setAction('Refreshing workspace');
      const payload = await api.appState();
      setState(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Bob workspace.');
    } finally {
      setLoading(false);
      if (!quiet) setAction(null);
    }
  };

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 1024) {
        setShowSettings(false);
      }
    };

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    let socket: ReturnType<typeof io> | null = null;
    let mounted = true;

    const load = async () => {
      await refreshState(true);
    };

    void load();

    socket = io(realtimeBaseUrl() || window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true
    });

    socket.on('connect', () => {
      if (!mounted) return;
      setLiveStatus('connected');
      socket?.emit('request_update');
    });

    socket.on('update', (payload: DashboardPayload) => {
      if (!mounted) return;
      setState((current) => ({ ...current, dashboard: payload }));
      setLoading(false);
      setError(null);
    });

    socket.on('scan_complete', () => {
      if (!mounted) return;
      setNotice('Scan completed. Dashboard refreshed from backend results.');
      void refreshState(true);
    });

    socket.on('disconnect', () => {
      if (!mounted) return;
      setLiveStatus('disconnected');
    });

    return () => {
      mounted = false;
      socket?.disconnect();
    };
  }, []);

  const runScan = async () => {
    try {
      setAction('Starting scan');
      setNotice(null);
      await api.scan();
      setNotice('Scan started. Bob will update this dashboard when GitHub results arrive.');
      await refreshState(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start scan.');
    } finally {
      setAction(null);
    }
  };

  const discoverRepos = async () => {
    try {
      setAction('Discovering repositories');
      setNotice(null);
      await api.discoverRepos();
      await refreshState(true);
      setNotice('Repository discovery completed from your GitHub account.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to discover repositories.');
    } finally {
      setAction(null);
    }
  };

  const changeIssueStatus = async (issue: IssueItem, status: IssueStatus) => {
    if (!issue.id) return;
    try {
      setAction(`Updating ${issue.repo || 'issue'}`);
      await api.updateIssueStatus(issue.id, status);
      await refreshState(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update issue status.');
    } finally {
      setAction(null);
    }
  };

  const saveSettings = async (nextSettings: AppSettings) => {
    try {
      setAction('Saving settings');
      await api.saveSettings(nextSettings);
      await refreshState(true);
      setNotice('Monitoring settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setAction(null);
    }
  };

  const toggleRepo = async (repo: RepoItem) => {
    if (!repo.full_name) return;
    const excluded = new Set(settings.excluded_repos || []);
    if (excluded.has(repo.full_name)) {
      excluded.delete(repo.full_name);
    } else {
      excluded.add(repo.full_name);
    }
    await saveSettings({ ...settings, excluded_repos: Array.from(excluded) });
  };

  const updateScanInterval = async (value: string) => {
    const scanInterval = Number(value);
    if (!Number.isFinite(scanInterval)) return;
    await saveSettings({ ...settings, scan_interval: Math.max(60, scanInterval) });
  };

  const routeIssueToAgent = (issue: IssueItem, agentName: string) => {
    setAction(`Routing ${issue.repo || 'issue'} to ${agentName}`);
    window.setTimeout(() => {
      void changeIssueStatus(issue, 'in_progress');
    }, 450);
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you sure you want to permanently delete your account and all associated repository metadata? This action cannot be undone.")) {
      return;
    }
    try {
      setAction('Deleting account');
      await api.deleteAccount();
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete account.');
      setAction(null);
    }
  };

  const title = mode === 'org' ? 'PR command center' : 'My PR command center';
  const subtitle = mode === 'org'
    ? 'Bob monitors authenticated GitHub repositories, groups delivery risks, and keeps repo controls close to the work.'
    : 'Bob tracks your authenticated pull request risks and turns them into a focused action queue.';
  const modeLabel = mode === 'org' ? 'Org workspace' : 'Personal workspace';
  const activeRepoCount = state.meta?.active_repo_count ?? activeRepos.length;

  return (
    <main className="ops-shell bento-theme">
      <nav className="ops-topbar">
        <div className="ops-topbar-main">
          <a href="/" className="ops-brand" aria-label="Bob home">
            <span>B</span>
            Bob
          </a>
          <div className="ops-topbar-center">
            <a href="#overview" className="active">Overview</a>
            <a href="#queue">Risk queue</a>
            <a href="#repos">Repositories</a>
            <a href="#settings">Settings</a>
          </div>
        </div>
        <div className="ops-topbar-right">
          <div className="ops-live-status" aria-live="polite">
            <span className={`ops-dot ${liveStatus}`} />
            <small>{formatStatus(liveStatus)}</small>
          </div>
          <button
            type="button"
            className="ops-button settings-toggle"
            aria-expanded={showSettings}
            onClick={() => setShowSettings((s) => !s)}
            title="Toggle settings"
          >
            {showSettings ? 'Close' : 'Settings'}
          </button>
          <a href="/logout" className="logout-link ops-button outline">Logout</a>
        </div>
      </nav>

      <section className="ops-main">
        <div className="ops-command-bar" aria-label="Dashboard command summary">
          <div>
            <span className="ops-command-eyebrow">Live workspace</span>
            <strong>{openIssues.length ? `${openIssues.length} active risks` : 'All clear right now'}</strong>
          </div>
          <div className="ops-command-search" aria-hidden="true">
            <span>Search repos, PRs, blockers</span>
            <kbd>/</kbd>
          </div>
          <div className="ops-command-agents" aria-label="Available routing agents">
            <span>Copilot</span>
            <span>Jules</span>
            <span>Codex</span>
          </div>
        </div>

        <header className="ops-hero" id="overview">
          <div className="ops-hero-copy">
            <div className="ops-hero-badges">
              <p className="ops-kicker">GitHub authenticated workspace</p>
              <span className="ops-mode-pill">{modeLabel}</span>
            </div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
            <div className="ops-actions">
              <button type="button" className="ops-button secondary" onClick={() => void discoverRepos()} disabled={!!action}>
                Discover repos
              </button>
              <button type="button" className="ops-button secondary" onClick={() => void refreshState()} disabled={!!action}>
                Refresh
              </button>
              <button type="button" className="ops-button primary" onClick={() => void runScan()} disabled={!!action || !activeRepos.length}>
                Run PR scan
              </button>
            </div>
          </div>

          <aside className="ops-hero-card bento-box" aria-label="Workspace summary">
            <p className="ops-card-label">Workspace pulse</p>
            <div className="ops-hero-score">
              <strong>{openIssues.length}</strong>
              <span>open risks across {affectedRepoCount} repositories</span>
            </div>
            <div className="ops-hero-stats">
              <div>
                <strong>{activeRepoCount}</strong>
                <span>active repos</span>
              </div>
              <div>
                <strong>{settings.scan_interval ?? 300}s</strong>
                <span>scan cadence</span>
              </div>
              <div>
                <strong>{ciFailures.length + mergeConflicts.length}</strong>
                <span>critical blockers</span>
              </div>
            </div>
            <p className="ops-hero-note">
              Use discovery to populate new repos, then run a scan to refresh live GitHub risk signals.
            </p>
            <div className="ops-system-strip" aria-label="Risk pipeline">
              <span>Discover</span>
              <i />
              <span>Scan</span>
              <i />
              <span>Route</span>
            </div>
          </aside>
        </header>

        <div className="ops-alert-stack">
          {error ? <div className="ops-alert danger">{error}</div> : null}
          {notice ? <div className="ops-alert success">{notice}</div> : null}
          {action ? <div className="ops-alert neutral">{action}...</div> : null}
        </div>

        <div className="ops-metrics">
          <article className="bento-box ops-metric-card">
            <span>Open risks</span>
            <strong>{openIssues.length}</strong>
            <p>{affectedRepoCount} repositories currently need attention.</p>
          </article>
          <article className="bento-box ops-metric-card">
            <span>Merge conflicts</span>
            <strong>{mergeConflicts.length}</strong>
            <p>Branch collisions that need intervention before merge.</p>
          </article>
          <article className="bento-box ops-metric-card">
            <span>CI failures</span>
            <strong>{ciFailures.length}</strong>
            <p>Workflow runs that are red and blocking confidence.</p>
          </article>
          <article className="bento-box ops-metric-card">
            <span>Clean active repos</span>
            <strong>{cleanRepos.length}</strong>
            <p>{activeRepos.length} active repositories are currently being watched.</p>
          </article>
        </div>

        <section className="ops-grid">
          <div className="ops-panel bento-box large" id="queue">
            <div className="ops-panel-head">
              <div>
                <p className="ops-kicker">Management queue</p>
                <h2>Pull request risks</h2>
              </div>
              <span className="ops-badge">{loading ? 'Loading' : `${openIssues.length} open`}</span>
            </div>

            {loading ? (
              <div className="ops-empty">Loading real GitHub data from the backend...</div>
            ) : openIssues.length ? (
              <div className="ops-issue-list">
                {openIssues.map((issue) => (
                  <article className="ops-issue bento-inner" key={issue.id || issue.issue_key}>
                    <div className={`ops-issue-mark ${issueTone(issue)}`} />
                    <div className="ops-issue-content">
                      <div className="ops-issue-head">
                        <div className="ops-issue-meta">
                          <span className="issue-label">{issueLabel(issue)}</span>
                          <span className="ops-meta-pill">{issue.repo || 'Unknown repository'}</span>
                          {issue.pr_number ? <span className="ops-meta-pill">PR #{issue.pr_number}</span> : null}
                        </div>
                        <span className={`ops-status-pill ${issueTone(issue)}`}>{formatStatus(issue.status)}</span>
                      </div>
                      <h3>{issue.title || 'Untitled GitHub issue'}</h3>
                      <p className="issue-desc">{issue.branch ? `Branch: ${issue.branch}` : 'Branch data unavailable'} · Status: {formatStatus(issue.status)}</p>

                      <div className="ops-row-actions ai-triggers">
                        <div className="ops-primary-actions">
                          {issue.url ? <a href={issue.url} target="_blank" rel="noreferrer" className="ops-button outline sm">Open GitHub</a> : null}
                          <button type="button" className="ops-button outline sm resolve-btn" onClick={() => void changeIssueStatus(issue, 'resolved')}>
                            Resolve
                          </button>
                        </div>

                        <div className="ai-group">
                          <span className="ai-group-label">Route to</span>
                          <button type="button" className="ops-button ai-action copilot" onClick={() => routeIssueToAgent(issue, 'Copilot')}>
                            Copilot
                          </button>
                          <button type="button" className="ops-button ai-action jules" onClick={() => routeIssueToAgent(issue, 'Jules')}>
                            Jules
                          </button>
                          <button type="button" className="ops-button ai-action codex" onClick={() => routeIssueToAgent(issue, 'Codex')}>
                            Codex
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="ops-empty">
                <strong>No open PR risks in the database.</strong>
                <p>Run discovery and a PR scan to populate this queue from GitHub.</p>
                <button type="button" className="ops-button primary mt-4" onClick={() => void runScan()} disabled={!!action || !activeRepos.length}>
                  Run PR scan
                </button>
              </div>
            )}
          </div>

          <aside
            id="settings"
            className={`ops-panel bento-box sidebar-settings ${showSettings ? 'show' : ''}`}
          >
            <div className="ops-panel-head">
              <div>
                <p className="ops-kicker">Automation settings</p>
                <h2>Controls</h2>
              </div>
              <button
                type="button"
                className="ops-button settings-close"
                onClick={() => setShowSettings(false)}
                aria-label="Close settings"
              >
                Close
              </button>
            </div>

            <div className="ops-settings-stack">
              <label className="ops-field">
                <span>Scan interval seconds</span>
                <input
                  type="number"
                  min={60}
                  className="bento-input"
                  value={settings.scan_interval ?? 300}
                  onChange={(event) => setState((current) => ({
                    ...current,
                    settings: { ...(current.settings || {}), scan_interval: Number(event.target.value) }
                  }))}
                  onBlur={(event) => void updateScanInterval(event.target.value)}
                />
              </label>

              <label className="ops-switch">
                <span>
                  <strong>In-app notifications</strong>
                  <small>Stored in backend settings.</small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.notify_in_app ?? true}
                  onChange={(event) => void saveSettings({ ...settings, notify_in_app: event.target.checked })}
                />
              </label>

              <div className="ops-settings-note bento-inner">
                <strong>{activeRepoCount}</strong>
                <div>
                  <span>active repos</span>
                  <small>{repos.length} repositories discovered</small>
                </div>
              </div>

              <div className="ops-danger-zone bento-inner danger">
                <h3>Danger Zone</h3>
                <p>Permanently delete your account and all associated repository metadata from Bob. This cannot be undone.</p>
                <button
                  type="button"
                  className="ops-button danger"
                  onClick={() => void handleDeleteAccount()}
                  disabled={!!action}
                >
                  Delete Account
                </button>
              </div>
            </div>
          </aside>
        </section>

        <section className="ops-panel bento-box" id="repos">
          <div className="ops-panel-head">
            <div>
              <p className="ops-kicker">Repository management</p>
              <h2>Connected repositories</h2>
            </div>
            <span className="ops-badge">{repos.length} discovered</span>
          </div>

          {repos.length ? (
            <div className="ops-repo-grid">
              {repos.map((repo) => (
                <article className="ops-repo bento-inner" key={repo.full_name}>
                  <div className="ops-repo-head">
                    <div>
                      <h3>{repo.full_name}</h3>
                      <p>{repo.language || 'Unknown language'} · {repo.permission || repo.permissions_level || 'unknown'} access</p>
                    </div>
                    <span className={`ops-status-pill ${repo.is_active ? 'success' : 'neutral'}`}>
                      {repo.is_active ? 'Monitoring on' : 'Paused'}
                    </span>
                  </div>
                  <div className="ops-repo-foot">
                    <span className="repo-risks">{repo.issue_count ?? 0} linked risks</span>
                    <button type="button" className="ops-button outline sm" onClick={() => void toggleRepo(repo)} disabled={!!action}>
                      {repo.is_active ? 'Pause' : 'Resume'} monitoring
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="ops-empty">
              <strong>No repositories have been discovered yet.</strong>
              <p>Use GitHub discovery after sign-in to load repositories from the backend.</p>
              <button type="button" className="ops-button primary mt-4" onClick={() => void discoverRepos()} disabled={!!action}>
                Discover repositories
              </button>
            </div>
          )}
        </section>
      </section>

      <nav className="ops-mobile-dock" aria-label="Mobile dashboard navigation">
        <a href="#overview">Pulse</a>
        <a href="#queue">Queue</a>
        <a href="#repos">Repos</a>
        <button
          type="button"
          onClick={() => setShowSettings((s) => !s)}
          aria-expanded={showSettings}
        >
          Settings
        </button>
      </nav>
    </main>
  );
}
