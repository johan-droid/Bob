"use client";

import { useMemo, useState } from 'react';

export function SettingsForm() {
  const [slackWebhook, setSlackWebhook] = useState('');
  const [discordWebhook, setDiscordWebhook] = useState('');
  const [labelConflict, setLabelConflict] = useState(true);
  const [tagAuthor, setTagAuthor] = useState(true);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const isDirty = useMemo(() => true, [slackWebhook, discordWebhook, labelConflict, tagAuthor]);

  return (
    <div className="settings-grid">
      <section className="settings-card">
        <div className="kicker">Org settings</div>
        <h1 className="auth-title" style={{ marginTop: 10 }}>Automation preferences</h1>
        <p>Keep the org-level routing rules, webhook destinations, and auto-tagging behavior in one place.</p>

        <div className="stack" style={{ marginTop: 22 }}>
          <label className="field">
            <span>Slack webhook</span>
            <input value={slackWebhook} onChange={(event) => setSlackWebhook(event.target.value)} placeholder="https://hooks.slack.com/..." />
          </label>

          <label className="field">
            <span>Discord webhook</span>
            <input value={discordWebhook} onChange={(event) => setDiscordWebhook(event.target.value)} placeholder="https://discord.com/api/webhooks/..." />
          </label>

          <label className="toggle-row feature-card">
            <span>Auto-label merge conflicts</span>
            <input type="checkbox" checked={labelConflict} onChange={(event) => setLabelConflict(event.target.checked)} />
          </label>

          <label className="toggle-row feature-card">
            <span>Tag author on failing CI</span>
            <input type="checkbox" checked={tagAuthor} onChange={(event) => setTagAuthor(event.target.checked)} />
          </label>

          <div className="auth__actions">
            <button type="button" className="button" disabled={!isDirty} onClick={() => setSavedAt(new Date().toLocaleTimeString())}>
              Save changes
            </button>
            <button type="button" className="button-secondary">Force sync</button>
          </div>

          {savedAt ? <div className="success-banner">Saved at {savedAt}</div> : null}
        </div>
      </section>

      <aside className="settings-card">
        <div className="kicker">What changes</div>
        <div className="stack" style={{ marginTop: 18 }}>
          <div className="step-card"><h3>Webhook routing</h3><p>Choose where Bob posts issue notifications and reminders.</p></div>
          <div className="step-card"><h3>Conflict handling</h3><p>Enable or disable automatic labeling when merge conflicts are found.</p></div>
          <div className="step-card"><h3>Author nudges</h3><p>Configure whether failing checks should mention the PR author.</p></div>
        </div>
      </aside>
    </div>
  );
}