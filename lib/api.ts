type ApiInit = RequestInit & {
  skipJsonContentType?: boolean;
};

export type IssueStatus = 'pending' | 'in_progress' | 'failed' | 'resolved';

export type IssueItem = {
  id?: number;
  repo?: string;
  issue_key?: string;
  title?: string;
  url?: string;
  branch?: string;
  pr_number?: number;
  run_id?: string;
  type?: 'merge_conflict' | 'ci_failure' | string;
  status?: IssueStatus;
  last_commented_at?: string | null;
  comment_count?: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type RepoItem = {
  full_name?: string;
  private?: boolean;
  url?: string;
  language?: string;
  permission?: string;
  permissions_level?: string;
  agent_permission?: string;
  issue_count?: number;
  is_active?: boolean;
  archived?: boolean;
  fork?: boolean;
  last_synced?: string | null;
};

export type DashboardPayload = {
  stats?: { total?: number; pending?: number; in_progress?: number; failed?: number; resolved?: number };
  pending?: IssueItem[];
  in_progress?: IssueItem[];
  failed?: IssueItem[];
  resolved?: IssueItem[];
  repos?: RepoItem[];
};

export type AppSettings = {
  scan_interval?: number;
  excluded_repos?: string[];
  notify_in_app?: boolean;
  slack_webhook?: string;
  discord_webhook?: string;
  auto_label_conflict?: boolean;
  tag_author_on_fail?: boolean;
  updated_at?: string | null;
};

export type AppState = {
  user?: {
    id?: number;
    github_id?: number;
    username?: string;
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
    last_login?: string | null;
  };
  dashboard?: DashboardPayload;
  settings?: AppSettings;
  meta?: {
    scan_interval_seconds?: number;
    tracked_repo_count?: number;
    active_repo_count?: number;
    target_repos_configured?: boolean;
    websocket_path?: string;
  };
};

let csrfToken: string | null = null;

export function apiBaseUrl() {
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, '');
  }

  return '';
}

export function realtimeBaseUrl() {
  const configuredBaseUrl = apiBaseUrl();
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && 
      window.location.port === '3000') {
    return 'http://localhost:5000';
  }

  return '';
}

function apiUrl(path: string) {
  return `${apiBaseUrl()}${path}`;
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch(apiUrl('/api/csrf-token'), { credentials: 'include' });
  if (!response.ok) return null;
  const payload = await response.json() as { csrf_token?: string };
  csrfToken = payload.csrf_token || null;
  return csrfToken;
}

async function readError(response: Response) {
  try {
    const payload = await response.json() as { error?: string; message?: string };
    return payload.error || payload.message || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

export async function apiFetch<T>(path: string, init: ApiInit = {}): Promise<T> {
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers);

  if (!init.skipJsonContentType && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !headers.has('X-CSRFToken')) {
    const token = await getCsrfToken();
    if (token) headers.set('X-CSRFToken', token);
  }

  const response = await fetch(apiUrl(path), {
    ...init,
    method,
    credentials: 'include',
    headers
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  appState: () => apiFetch<AppState>('/api/app-state'),
  dashboard: () => apiFetch<DashboardPayload>('/api/dashboard-data'),
  settings: () => apiFetch<AppSettings>('/api/settings'),
  saveSettings: (settings: AppSettings) => apiFetch<{ saved: boolean }>('/api/settings', {
    method: 'POST',
    body: JSON.stringify(settings)
  }),
  scan: () => apiFetch<{ success: boolean; message?: string }>('/api/scan', { method: 'POST' }),
  discoverRepos: () => apiFetch<{ repos?: RepoItem[]; total?: number }>('/api/discover-repos', { method: 'POST' }),
  updateIssueStatus: (issueId: number, status: IssueStatus) => apiFetch<{ saved: boolean; issue: IssueItem }>(
    `/api/issues/${issueId}/status`,
    { method: 'POST', body: JSON.stringify({ status }) }
  ),
  deleteAccount: () => apiFetch<{ success: boolean }>('/api/account/delete', { method: 'POST' })
};
