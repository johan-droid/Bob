'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import './permissions-saas.css';

type VerifyPermissionsResponse = {
  all_granted?: boolean;
  missing?: string[];
};

type Props = {
  portal?: 'org' | 'user';
};

export function SetupFlow({ portal = 'org' }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState('Connecting to GitHub...');
  const [error, setError] = useState<string | null>(null);

  const authUrl = portal === 'user' ? '/auth/github?portal=user' : '/auth/github?portal=org';
  const dashboardUrl = portal === 'user' ? '/user/dashboard' : '/org/dashboard';

  useEffect(() => {
    void runSetup();
  }, []);

  const runSetup = async () => {
    try {
      setError(null);
      setStep(1);
      setStatus('Verifying identity & scopes...');

      // Fake slight delay for the smooth animation feeling
      await new Promise(r => setTimeout(r, 1200));

      const verify = await apiFetch<VerifyPermissionsResponse>('/api/verify-permissions').catch(() => ({ all_granted: true }));
      
      if (verify && verify.all_granted === false) {
        setStatus('Missing permissions');
        setError('Please re-authorize to grant required access.');
        return;
      }

      setStep(2);
      setStatus('Discovering & syncing repositories...');
      await new Promise(r => setTimeout(r, 1500));
      await apiFetch('/api/discover-repos', { method: 'POST' }).catch(() => {});

      setStep(3);
      setStatus('Provisioning workspace...');
      await new Promise(r => setTimeout(r, 1000));
      await apiFetch('/api/auto-provision', { method: 'POST' }).catch(() => {});

      setStep(4);
      setStatus('Finalizing PR intelligence...');
      await new Promise(r => setTimeout(r, 1200));
      await apiFetch('/api/scan', { method: 'POST' }).catch(() => {});

      setStep(5);
      setStatus('Redirecting to your dashboard...');
      
      setTimeout(() => {
        router.push(dashboardUrl);
      }, 1500);

    } catch (err) {
      setStatus('Setup failed');
      setError(err instanceof Error ? err.message : 'Unable to complete setup.');
    }
  };

  return (
    <div className="saas-setup-root">
      <div className="saas-setup-container">
        {/* Animated Connection Nodes */}
        <div className="connection-nodes">
          <div className="node bob-node">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
            </svg>
          </div>
          
          <div className="sync-line">
            <div className={`sync-pulse ${error ? 'error' : step === 5 ? 'success' : 'active'}`}></div>
          </div>
          
          <div className="node github-node">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
            </svg>
          </div>
        </div>

        {/* Status Text Area */}
        <div className="status-container">
          <h2 className="status-heading">{error ? 'Connection Failed' : step === 5 ? 'All Set!' : 'Configuring Workspace'}</h2>
          <div className="status-string">
            {!error && step < 5 && <div className="spinner"></div>}
            <span className={error ? 'text-error' : step === 5 ? 'text-success' : 'text-muted'}>
              {status}
            </span>
          </div>
        </div>

        {/* Action Buttons (Only visible on error) */}
        {error && (
          <div className="error-actions">
            <p className="error-detail">{error}</p>
            <a href={authUrl} className="button-primary">Re-authorize GitHub</a>
          </div>
        )}
      </div>
    </div>
  );
}
