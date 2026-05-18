"use client";

import { useEffect, useState } from 'react';
import { api, type AppSettings, type AppState, type RepoItem } from '@/lib/api';

export function SettingsForm() {
  const [state, setState] = useState<AppState>({});
  const [draft, setDraft] = useState<AppSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const repos = state.dashboard?.repos || [];
  const excluded = new Set(draft.excluded_repos || []);

  const load = async () => {
    try {
      setLoading(true);
      const payload = await api.appState();
      setState(payload);
      setDraft(payload.settings || {});
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (nextDraft = draft) => {
    try {
      setSaving(true);
      await api.saveSettings(nextDraft);
      setSavedAt(new Date().toLocaleTimeString());
      const payload = await api.appState();
      setState(payload);
      setDraft(payload.settings || nextDraft);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const toggleRepo = async (repo: RepoItem) => {
    if (!repo.full_name) return;
    const nextExcluded = new Set(draft.excluded_repos || []);
    if (nextExcluded.has(repo.full_name)) {
      nextExcluded.delete(repo.full_name);
    } else {
      nextExcluded.add(repo.full_name);
    }
    const nextDraft = { ...draft, excluded_repos: Array.from(nextExcluded) };
    setDraft(nextDraft);
    await save(nextDraft);
  };

  return (
    <div className="settings-grid">
      <section className="settings-card">
        <div className="kicker">Backend settings</div>
        <h1 className="auth-title" style={{ marginTop: 10 }}>PR management controls</h1>
        <p>These settings are loaded from and saved to Bob's Flask API, so every control persists on the backend.</p>

        {error ? <div className="error-banner" style={{ marginTop: 18 }}>{error}</div> : null}
        {savedAt ? <div className="success-banner" style={{ marginTop: 18 }}>Saved at {savedAt}</div> : null}

        <div className="stack" style={{ marginTop: 22 }}>
          <label className="field">
            <span>Scan interval seconds</span>
            <input
              type="number"
              min={60}
              value={draft.scan_interval ?? 300}
              disabled={loading || saving}
              onChange={(event) => setDraft((current) => ({ ...current, scan_interval: Number(event.target.value) }))}
            />
          </label>

          <label className="toggle-row feature-card">
            <span>
              <strong>In-app notifications</strong>
              <p>Use the stored backend notification preference.</p>
            </span>
            <input
              type="checkbox"
              checked={draft.notify_in_app ?? true}
              disabled={loading || saving}
              onChange={(event) => setDraft((current) => ({ ...current, notify_in_app: event.target.checked }))}
            />
          </label>

          <div className="auth__actions">
            <button type="button" className="button" disabled={loading || saving} onClick={() => void save()}>
              {saving ? 'Saving...' : 'Save settings'}
            </button>
            <button type="button" className="button-secondary" disabled={loading || saving} onClick={() => void load()}>
              Reload from API
            </button>
          </div>
        </div>
      </section>

      <aside className="settings-card">
        <div className="kicker">Repository monitoring</div>
        <div className="stack" style={{ marginTop: 18 }}>
          {loading ? <div className="empty-state">Loading repositories from backend...</div> : null}
          {!loading && repos.length ? repos.map((repo) => (
            <div className="repo-card" key={repo.full_name}>
              <div className="toggle-row">
                <div>
                  <h3>{repo.full_name}</h3>
                  <p>{repo.language || 'Unknown language'} · {repo.issue_count ?? 0} linked risk(s)</p>
                </div>
                <button type="button" className="button-ghost" disabled={saving} onClick={() => void toggleRepo(repo)}>
                  {excluded.has(repo.full_name || '') ? 'Resume' : 'Pause'}
                </button>
              </div>
            </div>
          )) : null}
          {!loading && !repos.length ? (
            <div className="empty-state">No repositories are connected yet. Return to setup or dashboard discovery first.</div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
