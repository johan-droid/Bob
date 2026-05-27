"use client";

import { useState, useEffect, useMemo } from 'react';
import { useDashboard, issueTypeLabels } from '@/lib/use-dashboard';
import { MobileDashboard } from '@/components/mobile-dashboard';
import type { IssueItem } from '@/lib/api';

type Props = {
  mode: 'org' | 'user';
};

// ── Responsive switch ───────────────────────────────────────────────────────

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
}

// ── Desktop Dashboard ───────────────────────────────────────────────────────

function DesktopDashboard({ mode }: Props) {
  const db = useDashboard();
  const [activeRepoTab, setActiveRepoTab] = useState('all');
  const isUserMode = mode === 'user';
  const currentUsername = (db.state.user?.username || '').toLowerCase();
  const userScopedIssues = db.filteredIssues.filter((issue) => {
    if (!isUserMode) return true;
    return !!currentUsername && (issue.author || '').toLowerCase() === currentUsername;
  });
  const repoTabs = useMemo(() => {
    const repoNames = new Set<string>();
    db.repos.forEach((repo) => repo.full_name && repoNames.add(repo.full_name));
    userScopedIssues.forEach((issue) => issue.repo && repoNames.add(issue.repo));

    return [...repoNames].sort().map((repoName) => ({
      key: repoName,
      label: repoName.split('/').pop() || repoName,
      fullName: repoName,
      count: userScopedIssues.filter((issue) => issue.repo === repoName).length,
    }));
  }, [db.repos, userScopedIssues]);
  const visibleFilteredIssues = userScopedIssues.filter((issue) => (
    activeRepoTab === 'all' || issue.repo === activeRepoTab
  ));

  useEffect(() => {
    if (activeRepoTab === 'all') return;
    if (!repoTabs.some((repo) => repo.key === activeRepoTab)) {
      setActiveRepoTab('all');
    }
  }, [activeRepoTab, repoTabs]);

  const getIssueTypeBadge = (type: string | undefined) => {
    const info = issueTypeLabels[type || ''];
    if (!info) return null;
    const colorClasses: Record<string, string> = {
      warning: 'bg-warning/10 text-warning border-warning/20',
      danger: 'bg-danger/10 text-danger border-danger/20',
      purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${colorClasses[info.color] || ''}`}>
        <span className="material-symbols-outlined text-[14px]">{info.icon}</span>
        {info.label}
      </span>
    );
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
                {isUserMode ? 'Bob Developer' : 'Bob Org'}
              </span>
            </a>
            <div className="hidden md:flex items-center gap-1">
              <a href="#pipeline-health" className="px-4 py-2 rounded-full text-sm font-semibold bg-zinc-800 text-white transition-all">
                {isUserMode ? 'My PR Health' : 'Pipeline Health'}
              </a>
              <a href="#team-velocity" className="px-4 py-2 rounded-full text-sm font-semibold text-zinc-400 hover:text-white transition-all">
                Activity Feed
              </a>
              {!isUserMode && (
                <a href="/org/settings" className="px-4 py-2 rounded-full text-sm font-semibold text-zinc-400 hover:text-white transition-all">
                  Repo Settings
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900 border border-border" id="ws-status">
              <span className={`w-2 h-2 rounded-full ${
                db.liveStatus === 'connected' ? 'bg-success shadow-[0_0_10px_#10b981]' :
                db.liveStatus === 'disconnected' ? 'bg-danger shadow-[0_0_10px_#ef4444]' :
                'bg-warning shadow-[0_0_10px_#f59e0b] animate-pulse'
              }`} />
              <span className="text-xs font-bold text-zinc-400">
                {db.liveStatus === 'connected' ? 'Connected' : db.liveStatus === 'disconnected' ? 'Disconnected' : 'Connecting...'}
              </span>
            </div>

            {/* Real Notification Center */}
            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900 border border-border hover:bg-zinc-800 transition-colors"
                onClick={() => db.setShowNotifications(!db.showNotifications)}
                aria-label="Notifications"
              >
                <span className="material-symbols-outlined text-[18px]">notifications</span>
                {db.resolvedIssues.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-brand text-[10px] font-bold flex items-center justify-center text-white">
                    {db.resolvedIssues.length > 99 ? '99+' : db.resolvedIssues.length}
                  </span>
                )}
              </button>
              {db.showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-900 border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <h3 className="font-bold text-sm text-white">Recent Activity</h3>
                    <button type="button" className="text-xs text-zinc-400 hover:text-white" onClick={() => db.setShowNotifications(false)}>Close</button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {db.resolvedIssues.length === 0 && db.openIssues.length === 0 ? (
                      <p className="p-4 text-xs text-zinc-500 text-center">No activity yet. Run a scan to start tracking.</p>
                    ) : (
                      [...db.openIssues.slice(0, 5), ...db.resolvedIssues.slice(0, 5)].map((issue) => (
                        <div key={issue.id || issue.issue_key} className="px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-800/30">
                          <div className="flex items-center gap-2">
                            {getIssueTypeBadge(issue.type)}
                            <span className={`text-[10px] font-bold uppercase ${issue.status === 'resolved' ? 'text-success' : 'text-zinc-400'}`}>
                              {issue.status}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-300 mt-1 truncate">{issue.title}</p>
                          <p className="text-[10px] text-zinc-500 mt-0.5">{issue.repo}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-border flex items-center justify-center font-bold text-sm text-brand" title={db.state.user?.name || db.state.user?.username || ''}>
              {(db.state.user?.name || db.state.user?.username || 'U')[0].toUpperCase()}
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
              {isUserMode ? 'My PR Health' : 'Pipeline Health'}
            </h1>
            <p className="text-zinc-400 text-sm mt-1.5">
              {isUserMode
                ? 'Personal PR monitoring for work assigned to your GitHub account.'
                : 'Organization-wide PR monitoring — conflicts, CI, reviews, staleness, and PR sizing.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isUserMode ? (
              <a
                href="/permissions"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white text-black hover:bg-zinc-200 transition-colors shadow-lg shadow-white/5"
              >
                <span className="material-symbols-outlined text-[18px]">sync</span>
                Refresh Setup
              </a>
            ) : (
              <a
                href="/org/settings"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white text-black hover:bg-zinc-200 transition-colors shadow-lg shadow-white/5"
              >
                <span className="material-symbols-outlined text-[18px]">settings</span>
                Manage Settings
              </a>
            )}
          </div>
        </header>

        <div className="flex flex-col gap-4">
          {db.error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-red-500 text-[18px]">error</span>
              {db.error}
              <button type="button" onClick={() => db.setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          )}

          {db.notice && (
            <div className="bg-success/10 border border-success/20 text-success px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-success text-[18px]">check_circle</span>
              {db.notice}
            </div>
          )}

          {db.action && (
            <div className="bg-purple-500/10 border border-purple-500/20 text-purple-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-pulse">
              <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
              {db.action}...
            </div>
          )}
        </div>

        {/* KPI Cards — now includes all 5 issue types */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4" aria-label="Executive summary metrics">
          <div className="bg-surface-card border border-border rounded-2xl p-5 flex flex-col justify-between hover:border-zinc-700 transition-colors relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-warning/5 rounded-full blur-2xl group-hover:scale-110 transition-transform"></div>
            <div className="flex items-center gap-2 text-zinc-400">
              <span className="material-symbols-outlined text-warning text-[20px]">merge</span>
              <h3 className="text-xs font-bold uppercase tracking-wider">Conflicts</h3>
            </div>
            <strong className="text-3xl font-black mt-3 text-white" id="kpi-conflicts">
              {db.stats.conflicts ?? 0}
            </strong>
          </div>

          <div className="bg-surface-card border border-border rounded-2xl p-5 flex flex-col justify-between hover:border-zinc-700 transition-colors relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-danger/5 rounded-full blur-2xl group-hover:scale-110 transition-transform"></div>
            <div className="flex items-center gap-2 text-zinc-400">
              <span className="material-symbols-outlined text-danger text-[20px]">error_outline</span>
              <h3 className="text-xs font-bold uppercase tracking-wider">CI Failures</h3>
            </div>
            <strong className="text-3xl font-black mt-3 text-white" id="kpi-failing">
              {db.stats.failing ?? 0}
            </strong>
          </div>

          <div className="bg-surface-card border border-border rounded-2xl p-5 flex flex-col justify-between hover:border-zinc-700 transition-colors relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-purple-500/5 rounded-full blur-2xl group-hover:scale-110 transition-transform"></div>
            <div className="flex items-center gap-2 text-zinc-400">
              <span className="material-symbols-outlined text-purple-400 text-[20px]">rate_review</span>
              <h3 className="text-xs font-bold uppercase tracking-wider">Reviews</h3>
            </div>
            <strong className="text-3xl font-black mt-3 text-white" id="kpi-reviews">
              {db.stats.review_issues ?? 0}
            </strong>
          </div>

          <div className="bg-surface-card border border-border rounded-2xl p-5 flex flex-col justify-between hover:border-zinc-700 transition-colors relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-amber-500/5 rounded-full blur-2xl group-hover:scale-110 transition-transform"></div>
            <div className="flex items-center gap-2 text-zinc-400">
              <span className="material-symbols-outlined text-amber-400 text-[20px]">schedule</span>
              <h3 className="text-xs font-bold uppercase tracking-wider">Stale PRs</h3>
            </div>
            <strong className="text-3xl font-black mt-3 text-white" id="kpi-stale">
              {(db.stats.stale ?? 0) + (db.stats.oversized ?? 0)}
            </strong>
          </div>

          <div className="bg-surface-card border border-border rounded-2xl p-5 flex flex-col justify-between hover:border-zinc-700 transition-colors relative overflow-hidden group col-span-2 md:col-span-1">
            <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-success/5 rounded-full blur-2xl group-hover:scale-110 transition-transform"></div>
            <div className="flex items-center gap-2 text-zinc-400">
              <span className="material-symbols-outlined text-success text-[20px]">check_circle_outline</span>
              <h3 className="text-xs font-bold uppercase tracking-wider">Healthy</h3>
            </div>
            <strong className="text-3xl font-black mt-3 text-white" id="kpi-ready">
              {db.stats.ready ?? 0}
            </strong>
          </div>
        </section>

        {/* Actions Bar */}
        <section className="flex flex-wrap items-center gap-3 bg-surface-card border border-border rounded-2xl p-4">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest pl-2">Actions:</span>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 border border-border hover:bg-zinc-800 transition-colors disabled:opacity-50"
            onClick={() => void db.discoverRepos()}
            disabled={!!db.action}
          >
            <span className="material-symbols-outlined text-[16px]">search</span>
            Discover Repos
          </button>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 border border-border hover:bg-zinc-800 transition-colors disabled:opacity-50"
            onClick={() => void db.refreshState()}
            disabled={!!db.action}
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Refresh
          </button>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-brand hover:bg-brand/90 transition-colors disabled:opacity-50 text-white"
            onClick={() => void db.runScan()}
            disabled={!!db.action || !db.activeRepos.length}
          >
            <span className="material-symbols-outlined text-[16px]">run_circle</span>
            Run Full Scan
          </button>
        </section>

        {/* PR Issues Table with Real Filters */}
        <section id="pipeline-health" className="bg-surface-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-xs font-bold text-brand uppercase tracking-widest">Live Tracking</span>
              <h2 className="text-xl font-extrabold mt-0.5">Pull Request Health</h2>
            </div>
            <div className="flex items-center gap-2">
              {db.activeFilterCount > 0 && (
                <button
                  type="button"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20"
                  onClick={db.clearFilters}
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                  Clear ({db.activeFilterCount})
                </button>
              )}
              <button
                type="button"
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors ${db.showFilters ? 'bg-brand/10 border-brand/30 text-brand' : 'bg-zinc-900 border-border hover:bg-zinc-800'}`}
                onClick={() => db.setShowFilters(!db.showFilters)}
                aria-label="Toggle filters"
              >
                <span className="material-symbols-outlined text-[16px]">filter_list</span>
                Filter
              </button>
            </div>
          </div>

          <div className="mb-5 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max pb-1">
              <button
                type="button"
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  activeRepoTab === 'all'
                    ? 'bg-brand text-white border-brand'
                    : 'bg-zinc-900 border-border text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
                onClick={() => setActiveRepoTab('all')}
              >
                All repos
                <span className="ml-2 text-[10px] opacity-75">{userScopedIssues.length}</span>
              </button>
              {repoTabs.map((repo) => (
                <button
                  key={repo.key}
                  type="button"
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    activeRepoTab === repo.key
                      ? 'bg-brand text-white border-brand'
                      : 'bg-zinc-900 border-border text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                  title={repo.fullName}
                  onClick={() => setActiveRepoTab(repo.key)}
                >
                  {repo.label}
                  <span className={`ml-2 text-[10px] ${repo.count ? 'text-warning' : 'opacity-60'}`}>
                    {repo.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Real Filter Dropdowns */}
          {db.showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 p-4 bg-zinc-900/50 rounded-xl border border-border">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Repository</label>
                <select
                  className="bg-zinc-900 border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-brand"
                  value={db.filters.repo}
                  onChange={(e) => db.setFilters((f) => ({ ...f, repo: e.target.value }))}
                >
                  <option value="">All repos</option>
                  {db.allRepoNames.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Issue Type</label>
                <select
                  className="bg-zinc-900 border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-brand"
                  value={db.filters.type}
                  onChange={(e) => db.setFilters((f) => ({ ...f, type: e.target.value }))}
                >
                  <option value="">All types</option>
                  <option value="merge_conflict">Merge Conflicts</option>
                  <option value="ci_failure">CI Failures</option>
                  <option value="review_issue">Review Issues</option>
                  <option value="stale_pr">Stale PRs</option>
                  <option value="oversized_pr">Oversized PRs</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Status</label>
                <select
                  className="bg-zinc-900 border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-brand"
                  value={db.filters.status}
                  onChange={(e) => db.setFilters((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Author</label>
                <select
                  className="bg-zinc-900 border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-brand"
                  value={db.filters.author}
                  onChange={(e) => db.setFilters((f) => ({ ...f, author: e.target.value }))}
                >
                  <option value="">All authors</option>
                  {db.allAuthors.map((a) => <option key={a} value={a}>@{a}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-xs font-semibold uppercase">
                  <th className="py-3 px-4">Repository</th>
                  <th className="py-3 px-4">PR Details</th>
                  <th className="py-3 px-4">Developer</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody id="pr-table-body" className="divide-y divide-zinc-800 text-sm">
                {db.loading ? (
                  <tr className="empty-state-row">
                    <td colSpan={5} className="py-16 text-center text-zinc-500">
                      <div className="flex flex-col items-center gap-3">
                        <span className="material-symbols-outlined text-3xl animate-spin text-zinc-600">sync</span>
                        <p className="font-medium">Connecting and fetching real-time dashboard data...</p>
                      </div>
                    </td>
                  </tr>
                ) : visibleFilteredIssues.length ? (
                  visibleFilteredIssues.map((issue) => (
                    <tr key={issue.id || issue.issue_key} className="hover:bg-zinc-900/30 transition-colors">
                      <td className="py-4 px-4 font-semibold text-white">
                        <div className="flex flex-col">
                          <span className="text-zinc-200 text-sm">{issue.repo}</span>
                          {issue.branch && (
                            <span className="text-[10px] text-zinc-500 font-mono mt-0.5">{issue.branch}</span>
                          )}
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
                            ) : issue.run_id ? (
                              <span className="bg-zinc-800 px-2 py-0.5 rounded text-zinc-300 font-mono">
                                Run #{issue.run_id}
                              </span>
                            ) : null}
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
                        {getIssueTypeBadge(issue.type)}
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          {issue.url && (
                            <a
                              href={issue.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-bold text-brand hover:underline flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                              GitHub
                            </a>
                          )}
                          <button
                            type="button"
                            className="text-xs font-bold text-zinc-400 hover:text-white flex items-center gap-1"
                            onClick={() => void db.changeIssueStatus(issue, 'resolved')}
                          >
                            <span className="material-symbols-outlined text-[14px]">check</span>
                            Resolve
                          </button>

                          {/* Real actions based on issue type */}
                          {issue.type === 'ci_failure' && issue.run_id && (
                            <button
                              type="button"
                              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                              onClick={() => void db.handleRerunCi(issue)}
                              disabled={!!db.action}
                            >
                              <span className="material-symbols-outlined text-[14px]">replay</span>
                              Re-run CI
                            </button>
                          )}

                          {issue.pr_number && (
                            <>
                              {db.reviewInput?.issueId === issue.id ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    placeholder="user1,user2"
                                    className="bg-zinc-900 border border-border rounded px-2 py-1 text-xs text-white w-28 outline-none focus:border-brand"
                                    value={db.reviewInput?.value || ''}
                                    onChange={(e) => db.setReviewInput({ issueId: issue.id!, value: e.target.value })}
                                    onKeyDown={(e) => e.key === 'Enter' && void db.handleRequestReview(issue)}
                                  />
                                  <button
                                    type="button"
                                    className="text-xs font-bold text-success hover:text-success/80"
                                    onClick={() => void db.handleRequestReview(issue)}
                                  >
                                    Send
                                  </button>
                                  <button
                                    type="button"
                                    className="text-xs text-zinc-500 hover:text-zinc-300"
                                    onClick={() => db.setReviewInput(null)}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                  onClick={() => db.setReviewInput({ issueId: issue.id!, value: '' })}
                                >
                                  <span className="material-symbols-outlined text-[14px]">person_add</span>
                                  Request Review
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="empty-state-row">
                    <td colSpan={5} className="py-16 text-center text-zinc-500">
                      <div className="flex flex-col items-center gap-3">
                        <span className="material-symbols-outlined text-3xl text-zinc-600">
                          {db.activeFilterCount > 0 ? 'filter_list_off' : 'done_all'}
                        </span>
                        <p className="font-semibold text-white">
                          {db.activeFilterCount > 0 ? 'No issues match your filters.' : isUserMode ? 'No PR risks are assigned to you.' : 'No open PR risks detected.'}
                        </p>
                        <p className="text-zinc-400 text-xs mt-0.5">
                          {db.activeFilterCount > 0
                            ? 'Try adjusting your filter criteria or clear all filters.'
                            : isUserMode
                              ? 'Your assigned pull requests are clear. Run a scan to refresh.'
                              : 'All repositories are healthy. Run discovery and a PR scan to refresh.'
                          }
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Activity Feed + Org Settings (replaces dummy Team Velocity) */}
        <section id="team-velocity" className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-surface-card border border-border rounded-2xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-xs font-bold text-brand uppercase tracking-widest">Activity</span>
                <h2 className="text-xl font-extrabold mt-0.5">Recent Resolutions</h2>
              </div>
              <button
                type="button"
                className="w-8 h-8 rounded-xl bg-zinc-900 border border-border flex items-center justify-center hover:bg-zinc-800 transition-colors"
                onClick={() => void db.refreshState()}
                aria-label="Refresh activity feed"
              >
                <span className="material-symbols-outlined text-[16px] text-zinc-400">refresh</span>
              </button>
            </div>
            <div id="velocity-feed" className="flex-grow flex flex-col gap-2 overflow-y-auto max-h-80">
              {db.resolvedIssues.length > 0 ? (
                db.resolvedIssues.slice(0, 10).map((issue) => (
                  <div key={issue.id || issue.issue_key} className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/30 border border-border hover:bg-zinc-900/50 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-success text-[16px]">check_circle</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate">{issue.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                        <span>{issue.repo}</span>
                        <span>•</span>
                        <span>@{issue.author || 'unknown'}</span>
                        {issue.updated_at && (
                          <>
                            <span>•</span>
                            <span>{new Date(issue.updated_at).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center py-8 px-6 border border-dashed border-border rounded-xl text-center">
                  <span className="material-symbols-outlined text-zinc-600 text-3xl mb-2">timeline</span>
                  <p className="text-zinc-400 text-sm font-medium">No resolved issues yet.</p>
                  <p className="text-zinc-500 text-xs mt-1">Resolved PRs and fixed CI runs will appear here.</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface-card border border-border rounded-2xl p-6 flex flex-col justify-between">
            <div className="mb-6">
              <span className="text-xs font-bold text-brand uppercase tracking-widest">Quick Stats</span>
              <h2 className="text-xl font-extrabold mt-0.5">{isUserMode ? 'Personal Overview' : 'Organization Overview'}</h2>
            </div>
            <div className="flex flex-col gap-4 flex-grow">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-zinc-900/50 border border-border rounded-xl text-center">
                  <strong className="text-2xl font-black text-white">{db.repos.length}</strong>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1">Total Repos</p>
                </div>
                <div className="p-4 bg-zinc-900/50 border border-border rounded-xl text-center">
                  <strong className="text-2xl font-black text-white">{db.stats.total ?? 0}</strong>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1">Total Issues</p>
                </div>
                <div className="p-4 bg-zinc-900/50 border border-border rounded-xl text-center">
                  <strong className="text-2xl font-black text-success">{db.stats.resolved ?? 0}</strong>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1">Resolved</p>
                </div>
                <div className="p-4 bg-zinc-900/50 border border-border rounded-xl text-center">
                  <strong className="text-2xl font-black text-warning">{db.stats.pending ?? 0}</strong>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1">Pending</p>
                </div>
              </div>

              <div className="flex justify-between items-center py-4 border-t border-zinc-800 mt-auto">
                <div>
                  <h3 className="font-bold text-white text-sm">{isUserMode ? 'Repository Setup' : 'Repository Settings'}</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {isUserMode ? 'Refresh connected repositories and permissions.' : 'Manage org-level configuration.'}
                  </p>
                </div>
                <a
                  href={isUserMode ? '/permissions' : '/org/settings'}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-zinc-900 border border-border hover:bg-zinc-800 transition-colors text-white"
                >
                  <span className="material-symbols-outlined text-[16px]">{isUserMode ? 'sync' : 'open_in_new'}</span>
                  {isUserMode ? 'Refresh' : 'Settings'}
                </a>
              </div>
              <div className="flex justify-between items-center pt-2">
                <div>
                  <h3 className="font-bold text-red-500 text-sm">Danger Zone</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {isUserMode ? 'Permanently delete your workspace.' : 'Permanently delete organization.'}
                  </p>
                </div>
                <button
                  type="button"
                  id="delete-org-btn"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors"
                  onClick={() => void db.handleDeleteAccount()}
                >
                  <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                  {isUserMode ? 'Delete Workspace' : 'Delete Org'}
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// ── Exported Wrapper ────────────────────────────────────────────────────────

export function DashboardView({ mode }: Props) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileDashboard mode={mode} />;
  }

  return <DesktopDashboard mode={mode} />;
}
