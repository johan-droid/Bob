"use client";

import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { apiFetch } from '@/lib/api';

type IssueItem = {
  repo?: string;
  title?: string;
  author?: string;
  ci_status?: string;
  merge_health?: string;
  status?: string;
  url?: string;
  number?: number;
};

type RepoItem = {
  full_name?: string;
  permission?: string;
  agent_permission?: string;
  language?: string;
  issue_count?: number;
  is_active?: boolean;
};

type DashboardPayload = {
  stats?: { total?: number; pending?: number; in_progress?: number; failed?: number; resolved?: number };
  pending?: IssueItem[];
  in_progress?: IssueItem[];
  failed?: IssueItem[];
  resolved?: IssueItem[];
  repos?: RepoItem[];
};

type Props = {
  mode: 'org' | 'user';
};

const socketBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';

function combineIssues(data: DashboardPayload) {
  return [
    ...(data.pending || []).map((item) => ({ ...item, group: 'Pending' })),
    ...(data.in_progress || []).map((item) => ({ ...item, group: 'In progress' })),
    ...(data.failed || []).map((item) => ({ ...item, group: 'Failed' })),
    ...(data.resolved || []).map((item) => ({ ...item, group: 'Resolved' }))
  ];
}

export function DashboardView({ mode }: Props) {
  const [data, setData] = useState<DashboardPayload>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const issues = useMemo(() => combineIssues(data), [data]);
  const stats = data.stats || {};
  const repos = data.repos || [];

  useEffect(() => {
    let socket: ReturnType<typeof io> | null = null;
    let mounted = true;

    const load = async () => {
      try {
        const payload = await apiFetch<DashboardPayload>('/api/dashboard-data');
        if (!mounted) return;
        setData(payload);
        setLoading(false);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Unable to load dashboard data');
        setLoading(false);
      }
    };

    void load();

    socket = io(socketBaseUrl || window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true
    });

    socket.on('connect', () => {
      setLiveStatus('connected');
      socket?.emit('request_update');
    });

    socket.on('update', (payload: DashboardPayload) => {
      if (!mounted) return;
      setData(payload);
      setLoading(false);
      setError(null);
    });

    socket.on('disconnect', () => {
      if (!mounted) return;
      setLiveStatus('disconnected');
      setError((current) => current || 'Live sync disconnected; showing cached data.');
    });

    return () => {
      mounted = false;
      socket?.disconnect();
    };
  }, []);

  const title = mode === 'org' ? 'Org Command Center' : 'Developer Workspace';
  const subtitle = mode === 'org'
    ? 'Monitor every repository, triage failing checks, and keep delivery moving.'
    : 'Track your active pull requests and fix issues assigned to you.';

  return (
    <div className="dashboard-page page">
      <div className="dashboard-topbar">
        <div className="stack">
          <div className="kicker">Live sync enabled</div>
          <h1 className="page-title">{title}</h1>
          <p className="muted">{subtitle}</p>
        </div>
        <div className="stack" style={{ minWidth: '260px' }}>
          <span className={`status-pill ${liveStatus === 'connected' ? 'success' : liveStatus === 'disconnected' ? 'danger' : 'warning'}`}>
            {liveStatus === 'connected' ? 'Live sync connected' : liveStatus === 'disconnected' ? 'Live sync offline' : 'Connecting live sync'}
          </span>
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="stats-grid" style={{ marginTop: 20 }}>
        <div className="stat-card"><div className="kicker">Total</div><h3>{stats.total ?? 0}</h3><p>Open items across all repositories.</p></div>
        <div className="stat-card"><div className="kicker">Pending</div><h3>{stats.pending ?? 0}</h3><p>Items waiting for review or triage.</p></div>
        <div className="stat-card"><div className="kicker">In progress</div><h3>{stats.in_progress ?? 0}</h3><p>Issues already being worked on.</p></div>
        <div className="stat-card"><div className="kicker">Resolved</div><h3>{stats.resolved ?? 0}</h3><p>Closed or completed work items.</p></div>
      </div>

      <div className="dashboard-grid" style={{ marginTop: 20 }}>
        <section className="panel">
          <div className="section__head" style={{ marginBottom: 16 }}>
            <div>
              <div className="kicker">Issues</div>
              <h2>{mode === 'org' ? 'Organization issues' : 'My active work'}</h2>
            </div>
          </div>

          {loading ? (
            <div className="loading-list">Loading dashboard data…</div>
          ) : issues.length ? (
            <div className="stack">
              {issues.slice(0, 8).map((item, index) => (
                <div className="issue-card" key={`${item.repo}-${item.title}-${index}`}>
                  <div className="toggle-row" style={{ alignItems: 'start' }}>
                    <div>
                      <div className="kicker">{item.group}</div>
                      <h3>{item.title || 'Untitled issue'}</h3>
                      <p>{item.repo || 'Repository unavailable'}{item.number ? ` • #${item.number}` : ''}</p>
                    </div>
                    <span className="status-pill">{item.ci_status || item.merge_health || 'Queued'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No open issues found right now.</div>
          )}
        </section>

        <section className="panel">
          <div className="section__head" style={{ marginBottom: 16 }}>
            <div>
              <div className="kicker">Repositories</div>
              <h2>{mode === 'org' ? 'Tracked repos' : 'Your repos'}</h2>
            </div>
          </div>

          <div className="stack">
            {repos.length ? repos.slice(0, 8).map((repo) => (
              <div className="repo-card" key={repo.full_name}>
                <div className="toggle-row" style={{ alignItems: 'start' }}>
                  <div>
                    <h3>{repo.full_name || 'Unknown repo'}</h3>
                    <p>{repo.language || 'Unknown language'} • {repo.permission || 'unknown'} access</p>
                  </div>
                  <span className={`status-pill ${repo.is_active ? 'success' : 'warning'}`}>
                    {repo.is_active ? 'Active' : 'Paused'}
                  </span>
                </div>
                <p style={{ marginTop: 10 }}>{repo.issue_count ?? 0} linked item(s).</p>
              </div>
            )) : <div className="empty-state">No repositories synced yet.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
