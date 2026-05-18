"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type ScopeState = 'pending' | 'success' | 'warning' | 'danger';

type VerifyPermissionsResponse = {
  granted?: string[];
  required?: string[];
  missing?: string[];
  all_granted?: boolean;
};

type DiscoverResponse = {
  repos?: Array<{ full_name?: string; private?: boolean; language?: string; permissions?: Record<string, boolean> }>;
};

const requiredScopes = [
  { id: 'repo', label: 'Repository Access', scope: 'repo' },
  { id: 'org', label: 'Organization Membership', scope: 'read:org' },
  { id: 'discussion', label: 'Discussions', scope: 'write:discussion' },
  { id: 'workflow', label: 'GitHub Actions', scope: 'workflow' },
  { id: 'email', label: 'Email Address', scope: 'user:email' }
];

type Props = {
  portal?: 'org' | 'user';
};

export function SetupFlow({ portal = 'org' }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState('Preparing secure sign-in…');
  const [error, setError] = useState<string | null>(null);
  const [scopes, setScopes] = useState<Record<string, ScopeState>>(
    Object.fromEntries(requiredScopes.map((scope) => [scope.id, 'pending' as ScopeState]))
  );
  const [progress, setProgress] = useState(0);
  const [repos, setRepos] = useState<DiscoverResponse['repos']>([]);
  const [done, setDone] = useState(false);

  const authUrl = portal === 'user' ? '/auth/github?portal=user' : '/auth/github?portal=org';
  const dashboardUrl = portal === 'user' ? '/user/dashboard' : '/org/dashboard';

  useEffect(() => {
    void runSetup();
  }, []);

  const progressLabel = useMemo(() => {
    if (done) return 'Complete';
    if (error) return 'Needs attention';
    return `${progress}%`;
  }, [done, error, progress]);

  const runSetup = async () => {
    try {
      setError(null);
      setDone(false);
      setProgress(5);
      setStatus('Verifying GitHub OAuth scopes…');

      const verify = await apiFetch<VerifyPermissionsResponse>('/api/verify-permissions');
      const granted = verify.granted || [];
      const missing = verify.missing || [];

      setScopes(Object.fromEntries(requiredScopes.map((scope) => {
        const ok = granted.includes(scope.scope) || granted.includes(scope.scope.split(':')[0]);
        return [scope.id, ok ? 'success' : (missing.includes(scope.scope) ? 'danger' : 'warning')];
      })));

      if (!verify.all_granted) {
        setProgress(100);
        setStatus('Missing permissions detected');
        setError(`Please re-authorize GitHub access and grant: ${missing.join(', ') || 'the required scopes'}.`);
        return;
      }

      setProgress(28);
      setStatus('Discovering accessible repositories…');
      const discovered = await apiFetch<DiscoverResponse>('/api/discover-repos', { method: 'POST' });
      setRepos(discovered.repos || []);

      setProgress(56);
      setStatus('Provisioning repository access…');
      await apiFetch('/api/auto-provision', { method: 'POST' });

      setProgress(80);
      setStatus('Starting initial PR health scan…');
      await apiFetch('/api/scan', { method: 'POST' });

      setProgress(100);
      setStatus('Setup complete. Redirecting to your dashboard…');
      setDone(true);

      window.setTimeout(() => {
        router.push(dashboardUrl);
      }, 2200);
    } catch (err) {
      setProgress(100);
      setStatus('Setup failed');
      setError(err instanceof Error ? err.message : 'Unable to complete setup.');
    }
  };

  return (
    <div className="setup-grid">
      <section className="panel">
        <div className="kicker">Secure onboarding</div>
        <h2>GitHub sign-in is now simplified</h2>
        <p>
          Bob connects through a single GitHub OAuth entrypoint and then verifies permissions,
          discovers repositories, provisions access, and launches the first scan.
        </p>

        <div className="stack" style={{ marginTop: 18 }}>
          <div className="progress-bar" aria-label="setup progress"><span style={{ ['--progress' as never]: `${progress}%` }} /></div>
          <div className="toggle-row">
            <span className="muted">{status}</span>
            <span className="status-pill">{progressLabel}</span>
          </div>
        </div>

        {error ? <div className="error-banner" style={{ marginTop: 18 }}>{error}</div> : null}
        {done ? <div className="success-banner" style={{ marginTop: 18 }}>Your GitHub session is ready.</div> : null}

        <div className="auth__actions">
          <Link href={authUrl} className="button">Re-authorize GitHub</Link>
          <Link href={dashboardUrl} className="button-secondary">Open dashboard</Link>
          <button type="button" onClick={() => void runSetup()} className="button-ghost">Run setup again</button>
        </div>
      </section>

      <aside className="setup-rail">
        <div className="stack">
          <div className="kicker">Scopes</div>
          {requiredScopes.map((scope) => (
            <div className="feature-card" key={scope.id}>
              <div className="toggle-row">
                <div>
                  <h3>{scope.label}</h3>
                  <p className="mono">{scope.scope}</p>
                </div>
                <span className={`status-pill ${scopes[scope.id] || 'pending'}`}>{scopes[scope.id] || 'pending'}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="stack" style={{ marginTop: 20 }}>
          <div className="kicker">Repositories</div>
          {repos?.length ? repos.slice(0, 6).map((repo) => (
            <div className="repo-card" key={repo.full_name}>
              <h3>{repo.full_name}</h3>
              <p>{repo.language || 'Unknown language'}</p>
            </div>
          )) : <div className="empty-state">Repositories will appear here after discovery.</div>}
        </div>
      </aside>
    </div>
  );
}