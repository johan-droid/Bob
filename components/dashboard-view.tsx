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

  return (
    <div className="flex-grow flex flex-col">
      <nav className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <a href="/org/dashboard" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand to-emerald-400 flex items-center justify-center font-bold text-white shadow-lg shadow-brand/20 group-hover:scale-105 transition-transform">
                B
              </div>
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                Bob Org
              </span>
            </a>
            <div className="hidden md:flex items-center gap-1">
              <a href="#pipeline-health" className="px-4 py-2 rounded-full text-sm font-semibold bg-zinc-800 text-white transition-all">
                Pipeline Health
              </a>
              <a href="#team-velocity" className="px-4 py-2 rounded-full text-sm font-semibold text-zinc-400 hover:text-white transition-all">
                Team Velocity
              </a>
              <a href="/org/settings" className="px-4 py-2 rounded-full text-sm font-semibold text-zinc-400 hover:text-white transition-all">
                Repo Settings
              </a>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900 border border-border" id="ws-status">
              <span className={`w-2 h-2 rounded-full ${
                liveStatus === 'connected' ? 'bg-success shadow-[0_0_10px_#10b981]' :
                liveStatus === 'disconnected' ? 'bg-danger shadow-[0_0_10px_#ef4444]' :
                'bg-warning shadow-[0_0_10px_#f59e0b] animate-pulse'
              }`} />
              <span className="text-xs font-bold text-zinc-400">
                {liveStatus === 'connected' ? 'Connected' : liveStatus === 'disconnected' ? 'Disconnected' : 'Connecting...'}
              </span>
            </div>

            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-border flex items-center justify-center font-bold text-sm text-brand" title={state.user?.name || state.user?.username || ''}>
              {(state.user?.name || state.user?.username || 'U')[0].toUpperCase()}
            </div>

            <a href="/logout" className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-bold border border-border hover:bg-zinc-800 transition-colors">
              Logout
            </a>
          </div>
        </div>
      </nav>

      <main className="flex-grow max-w-[1400px] w-full mx-auto px-6 py-8 flex flex-col gap-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-border">
          <div>
            <span className="text-xs font-bold text-brand uppercase tracking-widest">Executive Summary</span>
            <h1 className="text-3xl font-black mt-1 tracking-tight bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
              Pipeline Health
            </h1>
            <p className="text-zinc-400 text-sm mt-1.5">
              Organization-wide pull request monitoring and CI analysis.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-zinc-900 border border-border hover:bg-zinc-800 transition-colors"
              aria-label="Notifications"
            >
              <span className="material-symbols-outlined text-[18px]">notifications</span>
              Alerts
            </button>
            <a
              href="/org/settings"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white text-black hover:bg-zinc-200 transition-colors shadow-lg shadow-white/5"
            >
              <span className="material-symbols-outlined text-[18px]">settings</span>
              Manage Settings
            </a>
          </div>
        </header>

        <div className="flex flex-col gap-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-red-500 text-[18px]">error</span>
              {error}
            </div>
          )}

          {notice && (
            <div className="bg-success/10 border border-success/20 text-success px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-success text-[18px]">check_circle</span>
              {notice}
            </div>
          )}

          {action && (
            <div className="bg-purple-500/10 border border-purple-500/20 text-purple-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-pulse">
              <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
              {action}...
            </div>
          )}
        </div>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6" aria-label="Executive summary metrics">
          <div className="bg-surface-card border border-border rounded-2xl p-6 flex flex-col justify-between hover:border-zinc-700 transition-colors relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-warning/5 rounded-full blur-2xl group-hover:scale-110 transition-transform"></div>
            <div className="flex items-center gap-3 text-zinc-400">
              <span className="material-symbols-outlined text-warning">warning</span>
              <h3 className="text-sm font-bold uppercase tracking-wider">Merge Conflicts</h3>
            </div>
            <strong className="text-4xl font-black mt-4 text-white" id="kpi-conflicts">
              {mergeConflicts.length}
            </strong>
          </div>

          <div className="bg-surface-card border border-border rounded-2xl p-6 flex flex-col justify-between hover:border-zinc-700 transition-colors relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-danger/5 rounded-full blur-2xl group-hover:scale-110 transition-transform"></div>
            <div className="flex items-center gap-3 text-zinc-400">
              <span className="material-symbols-outlined text-danger">error_outline</span>
              <h3 className="text-sm font-bold uppercase tracking-wider">Failing CI Checks</h3>
            </div>
            <strong className="text-4xl font-black mt-4 text-white" id="kpi-failing">
              {ciFailures.length}
            </strong>
          </div>

          <div className="bg-surface-card border border-border rounded-2xl p-6 flex flex-col justify-between hover:border-zinc-700 transition-colors relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-success/5 rounded-full blur-2xl group-hover:scale-110 transition-transform"></div>
            <div className="flex items-center gap-3 text-zinc-400">
              <span className="material-symbols-outlined text-success">check_circle_outline</span>
              <h3 className="text-sm font-bold uppercase tracking-wider">Ready to Merge</h3>
            </div>
            <strong className="text-4xl font-black mt-4 text-white" id="kpi-ready">
              {cleanRepos.length}
            </strong>
          </div>
        </section>

        <section className="flex flex-wrap items-center gap-3 bg-surface-card border border-border rounded-2xl p-4">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest pl-2">PR Actions:</span>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 border border-border hover:bg-zinc-800 transition-colors disabled:opacity-50"
            onClick={() => void discoverRepos()}
            disabled={!!action}
          >
            <span className="material-symbols-outlined text-[16px]">search</span>
            Discover Repositories
          </button>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 border border-border hover:bg-zinc-800 transition-colors disabled:opacity-50"
            onClick={() => void refreshState()}
            disabled={!!action}
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Refresh State
          </button>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-brand hover:bg-brand/90 transition-colors disabled:opacity-50 text-white"
            onClick={() => void runScan()}
            disabled={!!action || !activeRepos.length}
          >
            <span className="material-symbols-outlined text-[16px]">run_circle</span>
            Run PR Scan
          </button>
        </section>

        <section id="pipeline-health" className="bg-surface-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-xs font-bold text-brand uppercase tracking-widest">Live Tracking</span>
              <h2 className="text-xl font-extrabold mt-0.5">Pull Request Status</h2>
            </div>
            <button
              type="button"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-zinc-900 border border-border hover:bg-zinc-800 transition-colors"
              aria-label="Filter"
            >
              <span className="material-symbols-outlined text-[16px]">filter_list</span>
              Filter
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-xs font-semibold uppercase">
                  <th className="py-3 px-4">Repository</th>
                  <th className="py-3 px-4">PR Details</th>
                  <th className="py-3 px-4">Developer</th>
                  <th className="py-3 px-4">CI Status</th>
                  <th className="py-3 px-4">Merge Health</th>
                </tr>
              </thead>
              <tbody id="pr-table-body" className="divide-y divide-zinc-800 text-sm">
                {loading ? (
                  <tr className="empty-state-row">
                    <td colSpan={5} className="py-16 text-center text-zinc-500">
                      <div className="flex flex-col items-center gap-3">
                        <span className="material-symbols-outlined text-3xl animate-spin text-zinc-600">sync</span>
                        <p className="font-medium">Connecting and fetching real-time dashboard data...</p>
                      </div>
                    </td>
                  </tr>
                ) : openIssues.length ? (
                  openIssues.map((issue) => (
                    <tr key={issue.id || issue.issue_key} className="hover:bg-zinc-900/30 transition-colors">
                      <td className="py-4 px-4 font-semibold text-white">
                        <div className="flex flex-col">
                          <span className="text-zinc-200">{issue.repo}</span>
                          <span className="text-xs text-zinc-500 font-normal">GitHub Repository</span>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-white">{issue.title || 'Untitled Issue'}</span>
                          <div className="flex items-center gap-2 text-xs text-zinc-400">
                            {issue.pr_number ? (
                              <span className="bg-zinc-800 px-2 py-0.5 rounded text-zinc-300 font-mono">
                                PR #{issue.pr_number}
                              </span>
                            ) : null}
                            {issue.branch ? (
                              <span className="text-zinc-500 font-mono">branch: {issue.branch}</span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            {issue.url && (
                              <a
                                href={issue.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-bold text-brand hover:underline flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                Open GitHub
                              </a>
                            )}
                            <button
                              type="button"
                              className="text-xs font-bold text-zinc-400 hover:text-white flex items-center gap-1"
                              onClick={() => void changeIssueStatus(issue, 'resolved')}
                            >
                              <span className="material-symbols-outlined text-[14px]">check</span>
                              Resolve
                            </button>
                            
                            <div className="flex items-center gap-1.5 ml-2 border-l border-zinc-850 pl-3">
                              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Route to:</span>
                              <button
                                type="button"
                                className="text-xs font-bold text-purple-400 hover:text-purple-300 hover:underline"
                                onClick={() => routeIssueToAgent(issue, 'Copilot')}
                              >
                                Copilot
                              </button>
                              <button
                                type="button"
                                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:underline"
                                onClick={() => routeIssueToAgent(issue, 'Jules')}
                              >
                                Jules
                              </button>
                              <button
                                type="button"
                                className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline"
                                onClick={() => routeIssueToAgent(issue, 'Codex')}
                              >
                                Codex
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-zinc-800 border border-border flex items-center justify-center text-[10px] font-mono text-brand font-bold uppercase">
                            {issue.author ? issue.author[0] : 'U'}
                          </div>
                          <span className="text-zinc-300 text-sm font-medium">@{issue.author || 'unknown'}</span>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        {issue.type === 'ci_failure' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-danger/10 text-danger border border-danger/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse"></span>
                            CI Failure
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-success/10 text-success border border-success/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                            Passing
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        {issue.type === 'merge_conflict' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-warning/10 text-warning border border-warning/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse"></span>
                            Conflict
                          </span>
                        ) : issue.status === 'in_progress' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                            Resolving
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-success/10 text-success border border-success/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                            Clean
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="empty-state-row">
                    <td colSpan={5} className="py-16 text-center text-zinc-500">
                      <div className="flex flex-col items-center gap-3">
                        <span className="material-symbols-outlined text-3xl text-zinc-600">done_all</span>
                        <p className="font-semibold text-white">No open PR risks detected.</p>
                        <p className="text-zinc-400 text-xs mt-0.5">
                          All repositories are healthy and checked. Run discovery and a PR scan to refresh.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="team-velocity" className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-surface-card border border-border rounded-2xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-xs font-bold text-brand uppercase tracking-widest">Analytics</span>
                <h2 className="text-xl font-extrabold mt-0.5">Team Velocity</h2>
              </div>
              <button
                type="button"
                className="w-8 h-8 rounded-xl bg-zinc-900 border border-border flex items-center justify-center hover:bg-zinc-800 transition-colors"
                onClick={() => void refreshState()}
                aria-label="Refresh velocity feed"
              >
                <span className="material-symbols-outlined text-[16px] text-zinc-400">refresh</span>
              </button>
            </div>
            <div id="velocity-feed" className="flex-grow flex flex-col items-center justify-center py-12 px-6 border border-dashed border-border rounded-xl text-center">
              <span className="material-symbols-outlined text-zinc-600 text-3xl mb-2">timeline</span>
              <p className="text-zinc-400 text-sm font-medium">Waiting for team activity events to populate this feed.</p>
            </div>
          </div>

          <div className="bg-surface-card border border-border rounded-2xl p-6 flex flex-col justify-between">
            <div className="mb-6">
              <span className="text-xs font-bold text-brand uppercase tracking-widest">Configuration</span>
              <h2 className="text-xl font-extrabold mt-0.5">Organization Settings</h2>
            </div>
            <div className="flex flex-col gap-6 flex-grow justify-between">
              <div className="flex justify-between items-center py-4 border-b border-zinc-800">
                <div>
                  <h3 className="font-bold text-white text-sm">Repository Settings</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Manage org-level configuration.</p>
                </div>
                <a
                  href="/org/settings"
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-zinc-900 border border-border hover:bg-zinc-800 transition-colors text-white"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  Settings
                </a>
              </div>
              <div className="flex justify-between items-center pt-4">
                <div>
                  <h3 className="font-bold text-red-500 text-sm">Danger Zone</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Permanently delete organization.</p>
                </div>
                <button
                  type="button"
                  id="delete-org-btn"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors"
                  onClick={() => void handleDeleteAccount()}
                >
                  <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                  Delete Org
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
