"use client";

import { useEffect, useMemo, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import {
  api,
  realtimeBaseUrl,
  type AppState,
  type DashboardPayload,
  type IssueItem,
  type IssueStatus,
} from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

export type LiveStatus = 'connecting' | 'connected' | 'disconnected';

export type FilterState = {
  repo: string;
  type: string;
  status: string;
  author: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const issueStatuses: IssueStatus[] = ['pending', 'in_progress', 'failed', 'resolved'];

export const issueTypeLabels: Record<string, { label: string; icon: string; color: string }> = {
  merge_conflict: { label: 'Conflict', icon: 'merge', color: 'warning' },
  ci_failure: { label: 'CI Failure', icon: 'error_outline', color: 'danger' },
  review_issue: { label: 'Review', icon: 'rate_review', color: 'purple' },
  stale_pr: { label: 'Stale', icon: 'schedule', color: 'amber' },
  oversized_pr: { label: 'Oversized', icon: 'expand', color: 'blue' },
};

function combineIssues(data: DashboardPayload) {
  return issueStatuses.flatMap((status) =>
    (data[status] || []).map((item) => ({ ...item, status: item.status || status }))
  );
}

export function uniqueAuthors(issues: IssueItem[]) {
  return [...new Set(issues.map((i) => i.author).filter(Boolean))] as string[];
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboard() {
  const [state, setState] = useState<AppState>({});
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('connecting');
  const [showFilters, setShowFilters] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ repo: '', type: '', status: '', author: '' });
  const [reviewInput, setReviewInput] = useState<{ issueId: number; value: string } | null>(null);

  // Load initial state from cache if available (client-side only)
  useEffect(() => {
    try {
      const cached = localStorage.getItem('bob_dashboard_cache');
      if (cached) {
        setState(JSON.parse(cached));
        setLoading(false);
      }
    } catch (e) {
      console.warn('Failed to load cached dashboard state', e);
    }
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────
  const dashboard = state.dashboard || {};
  const settings = state.settings || {};
  const stats = dashboard.stats || {};
  const issues = useMemo(() => combineIssues(dashboard), [dashboard]);
  const repos = dashboard.repos || [];
  const openIssues = issues.filter((issue) => issue.status !== 'resolved');
  const resolvedIssues = issues.filter((issue) => issue.status === 'resolved');
  const activeRepos = repos.filter((repo) => repo.is_active);
  const cleanRepos = activeRepos.filter((repo) => !repo.issue_count);
  const allRepoNames = [...new Set(issues.map((i) => i.repo).filter(Boolean))] as string[];
  const allAuthors = uniqueAuthors(issues);

  const filteredIssues = useMemo(() => {
    return openIssues.filter((issue) => {
      if (filters.repo && issue.repo !== filters.repo) return false;
      if (filters.type && issue.type !== filters.type) return false;
      if (filters.status && issue.status !== filters.status) return false;
      if (filters.author && issue.author !== filters.author) return false;
      return true;
    });
  }, [openIssues, filters]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // Health score: percentage of repos that are clean
  const healthScore = useMemo(() => {
    if (!activeRepos.length) return 100;
    return Math.round((cleanRepos.length / activeRepos.length) * 100);
  }, [activeRepos.length, cleanRepos.length]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const refreshState = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setAction('Refreshing workspace');
      const payload = await api.appState();
      setState(payload);
      setError(null);
      try {
        localStorage.setItem('bob_dashboard_cache', JSON.stringify(payload));
      } catch (e) {
        console.warn('Failed to write dashboard state to cache', e);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Bob workspace.');
    } finally {
      setLoading(false);
      if (!quiet) setAction(null);
    }
  }, []);

  const runScan = useCallback(async () => {
    try {
      setAction('Starting scan');
      setNotice(null);
      await api.scan();
      setNotice('Scan started — detecting conflicts, CI failures, review issues, stale PRs, and oversized PRs.');
      await refreshState(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start scan.');
    } finally {
      setAction(null);
    }
  }, [refreshState]);

  const discoverRepos = useCallback(async () => {
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
  }, [refreshState]);

  const changeIssueStatus = useCallback(async (issue: IssueItem, status: IssueStatus) => {
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
  }, [refreshState]);

  const handleRerunCi = useCallback(async (issue: IssueItem) => {
    if (!issue.id) return;
    try {
      setAction(`Re-running CI for ${issue.repo}`);
      const result = await api.rerunCi(issue.id);
      setNotice(result.message || 'CI re-run triggered successfully.');
      await refreshState(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to re-run CI.');
    } finally {
      setAction(null);
    }
  }, [refreshState]);

  const handleRequestReview = useCallback(async (issue: IssueItem) => {
    if (!issue.id || !reviewInput?.value.trim()) return;
    try {
      const reviewers = reviewInput.value.split(',').map((r) => r.trim()).filter(Boolean);
      setAction(`Requesting review from ${reviewers.join(', ')}`);
      const result = await api.requestReview(issue.id, reviewers);
      setNotice(result.message || 'Review requested successfully.');
      setReviewInput(null);
      await refreshState(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request review.');
    } finally {
      setAction(null);
    }
  }, [refreshState, reviewInput]);

  const handleDeleteAccount = useCallback(async () => {
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
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ repo: '', type: '', status: '', author: '' });
  }, []);

  const setFilterByType = useCallback((type: string) => {
    setFilters((prev) => ({
      repo: '',
      status: '',
      author: '',
      type: prev.type === type ? '' : type,
    }));
  }, []);

  // ── Auto-dismiss notices ─────────────────────────────────────────────────
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  // ── Socket lifecycle ─────────────────────────────────────────────────────
  useEffect(() => {
    let socket: ReturnType<typeof io> | null = null;
    let mounted = true;

    void refreshState(true);

    socket = io(realtimeBaseUrl() || window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socket.on('connect', () => {
      if (!mounted) return;
      setLiveStatus('connected');
      socket?.emit('request_update');
    });

    socket.on('update', (payload: DashboardPayload) => {
      if (!mounted) return;
      setState((current) => {
        const next = { ...current, dashboard: payload };
        try {
          localStorage.setItem('bob_dashboard_cache', JSON.stringify(next));
        } catch (e) {
          console.warn('Failed to write dashboard state to cache', e);
        }
        return next;
      });
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
  }, [refreshState]);

  return {
    // State
    state,
    loading,
    action,
    error,
    notice,
    liveStatus,
    showFilters,
    showNotifications,
    filters,
    reviewInput,

    // Derived
    dashboard,
    settings,
    stats,
    issues,
    repos,
    openIssues,
    resolvedIssues,
    activeRepos,
    cleanRepos,
    allRepoNames,
    allAuthors,
    filteredIssues,
    activeFilterCount,
    healthScore,

    // Actions
    refreshState,
    runScan,
    discoverRepos,
    changeIssueStatus,
    handleRerunCi,
    handleRequestReview,
    handleDeleteAccount,
    clearFilters,
    setFilterByType,

    // Setters
    setError,
    setNotice,
    setShowFilters,
    setShowNotifications,
    setFilters,
    setReviewInput,
  };
}
