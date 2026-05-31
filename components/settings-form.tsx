"use client";

import { useEffect, useState } from 'react';
import { api, type AppSettings, type AppState, type RepoItem } from '@/lib/api';
import { AppNav } from '@/components/app-nav';

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
      setError(null);
      setSavedAt(null);
      await api.saveSettings(nextDraft);
      setSavedAt(`Saved at ${new Date().toLocaleTimeString()}`);
      const payload = await api.appState();
      setState(payload);
      setDraft(payload.settings || nextDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const forceSync = async () => {
    try {
      setSaving(true);
      setError(null);
      setSavedAt(null);
      await api.scan();
      setSavedAt("Sync initiated successfully.");
      setTimeout(() => {
        void load();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to initiate sync.');
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

  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you sure you want to permanently delete your account and all associated repository metadata? This action cannot be undone.")) {
      return;
    }
    try {
      setSaving(true);
      await api.deleteAccount();
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete account.');
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(state.settings || {});
  const canSave = hasChanges && !saving;

  return (
    <div className="flex-grow flex flex-col w-full">
      <AppNav
        activeTab="settings"
        userName={state.user?.name || state.user?.username || ''}
        rightSlot={
          <button
            type="button"
            className="px-5 py-2 rounded-xl text-sm font-bold bg-white text-black hover:bg-zinc-200 disabled:opacity-50 transition-colors"
            disabled={!canSave}
            onClick={() => void save()}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        }
      />

      {/* Main Content */}
      <main className="max-w-[1000px] w-full mx-auto px-6 py-8 flex flex-col gap-8">
        
        {/* Header Section */}
        <header className="pb-6 border-b border-border">
          <span className="text-xs font-bold text-brand uppercase tracking-widest">Configuration</span>
          <h1 className="text-3xl font-black mt-1 tracking-tight bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">Organization Settings</h1>
          <p className="text-zinc-400 text-sm mt-1.5">Manage repository integrations, alerting channels, and automated triage rules.</p>
        </header>

        {/* Message banners */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-red-500 text-[18px]">error</span>
            {error}
          </div>
        )}
        {savedAt && (
          <div className="bg-success/10 border border-success/20 text-success px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-success text-[18px]">check_circle</span>
            {savedAt}
          </div>
        )}

        {/* Monitored Repositories Card */}
        <section className="bg-surface-card border border-border rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-extrabold text-white">Monitored Repositories</h2>
              <p className="text-zinc-400 text-sm mt-0.5">Manage which GitHub repositories Bob tracks for CI failures and merge conflicts.</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-zinc-900 border border-border rounded-xl mb-6">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-zinc-400 text-2xl">sync</span>
              <div className="flex flex-col">
                <strong className="text-sm font-bold text-white">Synchronized</strong>
                <span className="text-zinc-400 text-xs mt-0.5">Real-time status syncing active.</span>
              </div>
            </div>
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 border border-border hover:bg-zinc-700 transition-colors text-white"
              onClick={() => void forceSync()}
            >
              Force Sync
            </button>
          </div>

          {/* Bento Grid of Connected Repositories */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? (
              <div className="col-span-full py-8 text-center text-zinc-500">
                <div className="flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-2xl animate-spin text-zinc-600">sync</span>
                  <p className="text-xs font-medium">Loading repositories from backend...</p>
                </div>
              </div>
            ) : repos.length ? (
              repos.map((repo) => {
                const isActive = !excluded.has(repo.full_name || '');
                return (
                  <div className="bg-zinc-900 border border-border rounded-xl p-4 flex flex-col justify-between hover:border-zinc-800 transition-colors" key={repo.full_name}>
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-sm font-bold text-white truncate">{repo.full_name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${repo.private ? 'bg-zinc-800 text-zinc-400' : 'bg-brand/10 text-brand'}`}>
                          {repo.private ? 'Private' : 'Public'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mb-4">{repo.language || 'Unknown language'} · {repo.issue_count ?? 0} active issues</p>
                    </div>
                    <div className="flex items-center justify-between mt-auto">
                      <span className={`text-xs font-bold ${isActive ? 'text-success' : 'text-zinc-500'}`}>
                        {isActive ? 'Monitoring active' : 'Paused'}
                      </span>
                      <button
                        type="button"
                        className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-zinc-800 border border-border hover:bg-zinc-750 transition-colors text-white"
                        onClick={() => void toggleRepo(repo)}
                      >
                        {isActive ? 'Pause' : 'Resume'}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full py-8 text-center text-zinc-500">
                <p className="text-xs font-medium">No repositories discovered yet. Go to dashboard and click Discover.</p>
              </div>
            )}
          </div>
        </section>

        {/* Notification Channels Card */}
        <section className="bg-surface-card border border-border rounded-2xl p-5">
          <div className="mb-6">
            <h2 className="text-xl font-extrabold text-white">Notification Channels</h2>
            <p className="text-zinc-400 text-sm mt-0.5">Configure where Bob routes high-priority pipeline blockers.</p>
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="slack-webhook" className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Slack Webhook URL</label>
              <input
                type="url"
                id="slack-webhook"
                className="w-full bg-zinc-900 border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-650 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-colors"
                placeholder="https://hooks.slack.com/services/..."
                value={draft.slack_webhook ?? ''}
                onChange={(event) => setDraft((current) => ({ ...current, slack_webhook: event.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="discord-webhook" className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Discord Webhook URL</label>
              <input
                type="url"
                id="discord-webhook"
                className="w-full bg-zinc-900 border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-650 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-colors"
                placeholder="https://discord.com/api/webhooks/..."
                value={draft.discord_webhook ?? ''}
                onChange={(event) => setDraft((current) => ({ ...current, discord_webhook: event.target.value }))}
              />
            </div>
          </div>
        </section>

        {/* Auto-Triage Rules Card */}
        <section className="bg-surface-card border border-border rounded-2xl p-5">
          <div className="mb-6">
            <h2 className="text-xl font-extrabold text-white">Auto-Triage Rules</h2>
            <p className="text-zinc-400 text-sm mt-0.5">Set up automated labeling and developer tagging for broken pipelines.</p>
          </div>

          <div className="flex flex-col gap-4">
            {/* Scan cadence input */}
            <div className="flex items-center justify-between p-4 bg-zinc-900/50 border border-border rounded-xl">
              <div>
                <h3 className="font-bold text-white text-sm">Scan cadence (seconds)</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Interval between automatic repository checks.</p>
              </div>
              <input
                type="number"
                min={60}
                className="w-24 bg-zinc-900 border border-border rounded-lg px-3 py-1.5 text-sm text-white focus:border-brand outline-none text-center"
                value={draft.scan_interval ?? 300}
                onChange={(event) => setDraft((current) => ({ ...current, scan_interval: Number(event.target.value) }))}
              />
            </div>

            {/* Rule Item 1 */}
            <div className="flex items-center justify-between p-4 bg-zinc-900/50 border border-border rounded-xl">
              <div>
                <h3 className="font-bold text-white text-sm">Auto-label Merge Conflicts</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Apply 'conflict-detected' label immediately upon detection.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer font-bold select-none">
                <input
                  type="checkbox"
                  id="rule-label-conflict"
                  className="sr-only peer"
                  checked={draft.auto_label_conflict ?? true}
                  onChange={(event) => setDraft((current) => ({ ...current, auto_label_conflict: event.target.checked }))}
                />
                <div className="w-11 h-6 bg-zinc-800 border border-border rounded-full peer peer-focus:ring-1 peer-focus:ring-brand peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
              </label>
            </div>

            {/* Rule Item 2 */}
            <div className="flex items-center justify-between p-4 bg-zinc-900/50 border border-border rounded-xl">
              <div>
                <h3 className="font-bold text-white text-sm">Tag PR Author on CI Failure</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Automatically mention the author in a PR comment if checks fail.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer font-bold select-none">
                <input
                  type="checkbox"
                  id="rule-tag-author"
                  className="sr-only peer"
                  checked={draft.tag_author_on_fail ?? false}
                  onChange={(event) => setDraft((current) => ({ ...current, tag_author_on_fail: event.target.checked }))}
                />
                <div className="w-11 h-6 bg-zinc-800 border border-border rounded-full peer peer-focus:ring-1 peer-focus:ring-brand peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
              </label>
            </div>
          </div>
        </section>

        {/* Danger Zone Section */}
        <section className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5">
          <div>
            <h2 className="text-xl font-extrabold text-red-500">Danger Zone</h2>
            <p className="text-zinc-400 text-sm mt-0.5">Permanently delete your account and all associated repository metadata. This action is irreversible.</p>
          </div>
          <div className="mt-6">
            <button
              type="button"
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-700 text-white transition-colors"
              onClick={() => void handleDeleteAccount()}
            >
              Delete Account
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
