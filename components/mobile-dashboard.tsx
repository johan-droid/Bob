"use client";

import { useRef, useState, useCallback, useEffect } from 'react';
import { useDashboard, issueTypeLabels } from '@/lib/use-dashboard';
import { api, type IssueItem } from '@/lib/api';

// ── Health Ring SVG ─────────────────────────────────────────────────────────

function HealthRing({ score, size = 52 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={size} height={size} className="mob-health-ring" viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize="13"
        fontWeight="800"
      >
        {score}%
      </text>
    </svg>
  );
}

// ── Issue Type Badge ────────────────────────────────────────────────────────

function TypeBadge({ type }: { type?: string }) {
  const info = issueTypeLabels[type || ''];
  if (!info) return null;
  return (
    <span className={`mob-badge mob-badge--${info.color}`}>
      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{info.icon}</span>
      {info.label}
    </span>
  );
}

// ── Issue Card ──────────────────────────────────────────────────────────────

function IssueCard({
  issue,
  expanded,
  onToggle,
  onResolve,
  onRerunCi,
  onRequestReview,
  disabled,
}: {
  issue: IssueItem;
  expanded: boolean;
  onToggle: () => void;
  onResolve: () => void;
  onRerunCi: () => void;
  onRequestReview: () => void;
  disabled: boolean;
}) {
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
    if (cardRef.current && touchDeltaX.current < 0) {
      const clamp = Math.max(touchDeltaX.current, -100);
      cardRef.current.style.transform = `translateX(${clamp}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (cardRef.current) {
      cardRef.current.style.transform = '';
    }
    if (touchDeltaX.current < -70) {
      onResolve();
    }
  }, [onResolve]);

  const age = issue.created_at
    ? (() => {
        const d = Math.floor((Date.now() - new Date(issue.created_at).getTime()) / 86400000);
        return d === 0 ? 'today' : d === 1 ? '1d' : `${d}d`;
      })()
    : '';

  return (
    <div className="mob-card-wrap">
      {/* Swipe reveal background */}
      <div className="mob-card-resolve-bg">
        <span className="material-symbols-outlined">check_circle</span>
        Resolve
      </div>

      <div
        ref={cardRef}
        className={`mob-card ${expanded ? 'mob-card--expanded' : ''}`}
        onClick={onToggle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Collapsed Row */}
        <div className="mob-card__row">
          <TypeBadge type={issue.type} />
          <div className="mob-card__info">
            <span className="mob-card__repo">{issue.repo}</span>
            {issue.pr_number && <span className="mob-card__pr">#{issue.pr_number}</span>}
          </div>
          <div className="mob-card__meta">
            <span className="mob-card__author">
              <span className="mob-card__avatar">{(issue.author || 'U')[0].toUpperCase()}</span>
            </span>
            {age && <span className="mob-card__age">{age}</span>}
          </div>
          <span className="material-symbols-outlined mob-card__chevron">
            {expanded ? 'expand_less' : 'expand_more'}
          </span>
        </div>

        {/* Expanded Detail */}
        {expanded && (
          <div className="mob-card__detail" onClick={(e) => e.stopPropagation()}>
            <p className="mob-card__title">{issue.title || 'Untitled Issue'}</p>
            {issue.branch && <p className="mob-card__branch">{issue.branch}</p>}
            <div className="mob-card__actions">
              <button
                type="button"
                className="mob-action mob-action--resolve"
                onClick={onResolve}
                disabled={disabled}
              >
                <span className="material-symbols-outlined">check</span>
                Resolve
              </button>
              {issue.type === 'ci_failure' && issue.run_id && (
                <button
                  type="button"
                  className="mob-action mob-action--ci"
                  onClick={onRerunCi}
                  disabled={disabled}
                >
                  <span className="material-symbols-outlined">replay</span>
                  Re-run CI
                </button>
              )}
              {issue.pr_number && (
                <button
                  type="button"
                  className="mob-action mob-action--review"
                  onClick={onRequestReview}
                  disabled={disabled}
                >
                  <span className="material-symbols-outlined">person_add</span>
                  Review
                </button>
              )}
              {issue.url && (
                <a
                  href={issue.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mob-action mob-action--gh"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="material-symbols-outlined">open_in_new</span>
                  GitHub
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Notification Sheet ──────────────────────────────────────────────────────

function NotifSheet({
  open,
  onClose,
  openIssues,
  resolvedIssues,
}: {
  open: boolean;
  onClose: () => void;
  openIssues: IssueItem[];
  resolvedIssues: IssueItem[];
}) {
  if (!open) return null;

  const items = [...openIssues.slice(0, 5), ...resolvedIssues.slice(0, 5)];

  return (
    <div className="mob-sheet-overlay" onClick={onClose}>
      <div className="mob-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mob-sheet__handle" />
        <h3 className="mob-sheet__title">Recent Activity</h3>
        <div className="mob-sheet__list">
          {items.length === 0 ? (
            <p className="mob-sheet__empty">No activity yet. Run a scan to start tracking.</p>
          ) : (
            items.map((issue) => (
              <div key={issue.id || issue.issue_key} className="mob-sheet__item">
                <TypeBadge type={issue.type} />
                <div className="mob-sheet__item-info">
                  <span className="mob-sheet__item-title">{issue.title}</span>
                  <span className="mob-sheet__item-meta">
                    {issue.repo} · @{issue.author || 'unknown'}
                    {issue.status === 'resolved' && ' · ✓ Resolved'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Review Modal (mobile-friendly) ──────────────────────────────────────────

function ReviewModal({
  open,
  onClose,
  onSubmit,
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  value: string;
  onChange: (v: string) => void;
}) {
  if (!open) return null;
  return (
    <div className="mob-sheet-overlay" onClick={onClose}>
      <div className="mob-sheet mob-sheet--small" onClick={(e) => e.stopPropagation()}>
        <div className="mob-sheet__handle" />
        <h3 className="mob-sheet__title">Request Review</h3>
        <p style={{ fontSize: 13, color: 'var(--m-muted)', margin: '0 0 12px' }}>
          Enter GitHub usernames, comma-separated
        </p>
        <input
          type="text"
          className="mob-review-input"
          placeholder="user1, user2"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          autoFocus
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button type="button" className="mob-action mob-action--resolve" style={{ flex: 1 }} onClick={onSubmit}>
            Send
          </button>
          <button type="button" className="mob-action" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Mobile Dashboard ───────────────────────────────────────────────────

export function MobileDashboard() {
  const db = useDashboard();
  const [expandedId, setExpandedId] = useState<number | string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<IssueItem | null>(null);
  const [reviewValue, setReviewValue] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  // Pull-to-refresh state
  const scrollRef = useRef<HTMLDivElement>(null);
  const pullStartY = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  const handlePullStart = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      pullStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, []);

  const handlePullMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling) return;
    const delta = e.touches[0].clientY - pullStartY.current;
    if (delta > 0) {
      setPullDistance(Math.min(delta * 0.5, 80));
    }
  }, [isPulling]);

  const handlePullEnd = useCallback(() => {
    if (pullDistance > 50) {
      void db.refreshState();
    }
    setPullDistance(0);
    setIsPulling(false);
  }, [pullDistance, db]);

  const handleReviewSubmit = useCallback(() => {
    if (!reviewTarget) return;
    db.setReviewInput({ issueId: reviewTarget.id!, value: reviewValue });
    // Small delay to let the state update propagate
    setTimeout(() => {
      void db.handleRequestReview(reviewTarget);
      setReviewTarget(null);
      setReviewValue('');
    }, 50);
  }, [reviewTarget, reviewValue, db]);

  // KPI chip data
  const kpis = [
    { key: 'merge_conflict', icon: 'merge', label: 'Conflicts', value: db.stats.conflicts ?? 0, color: 'warning' },
    { key: 'ci_failure', icon: 'error_outline', label: 'CI Fails', value: db.stats.failing ?? 0, color: 'danger' },
    { key: 'review_issue', icon: 'rate_review', label: 'Reviews', value: db.stats.review_issues ?? 0, color: 'purple' },
    { key: 'stale_pr', icon: 'schedule', label: 'Stale', value: (db.stats.stale ?? 0) + (db.stats.oversized ?? 0), color: 'amber' },
    { key: '', icon: 'check_circle', label: 'Healthy', value: db.stats.ready ?? 0, color: 'success' },
  ];

  return (
    <div className="mob-dash">
      {/* ── Pull to Refresh Indicator ─────────────────────────────────── */}
      <div
        className="mob-pull-indicator"
        style={{
          height: pullDistance,
          opacity: pullDistance > 10 ? 1 : 0,
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{
            transform: `rotate(${pullDistance * 3}deg)`,
            transition: pullDistance === 0 ? 'transform 0.3s' : 'none',
          }}
        >
          sync
        </span>
        <span className="mob-pull-text">
          {pullDistance > 50 ? 'Release to refresh' : 'Pull to refresh'}
        </span>
      </div>

      {/* ── Compact Header ────────────────────────────────────────────── */}
      <header className="mob-header">
        <div className="mob-header__left">
          <HealthRing score={db.healthScore} />
          <div className="mob-header__text">
            <h1 className="mob-header__title">PR Health</h1>
            <span className="mob-header__sub">
              {db.openIssues.length} open · {db.repos.length} repos
            </span>
          </div>
        </div>
        <div className="mob-header__right">
          <span className={`mob-dot mob-dot--${db.liveStatus}`} />
          <button
            type="button"
            className="mob-header__menu-btn"
            onClick={() => setShowMenu(true)}
            aria-label="Menu"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>
      </header>

      {/* ── Status Banners ────────────────────────────────────────────── */}
      {db.error && (
        <div className="mob-banner mob-banner--error">
          <span className="material-symbols-outlined">error</span>
          <span>{db.error}</span>
          <button type="button" onClick={() => db.setError(null)}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}
      {db.notice && (
        <div className="mob-banner mob-banner--success">
          <span className="material-symbols-outlined">check_circle</span>
          <span>{db.notice}</span>
        </div>
      )}
      {db.action && (
        <div className="mob-banner mob-banner--action">
          <span className="material-symbols-outlined mob-spin">sync</span>
          <span>{db.action}...</span>
        </div>
      )}

      {/* ── Scrollable Content ────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="mob-content"
        onTouchStart={handlePullStart}
        onTouchMove={handlePullMove}
        onTouchEnd={handlePullEnd}
      >
        {/* ── KPI Chips ────────────────────────────────────────────── */}
        <div className="mob-kpi-scroll">
          {kpis.map((kpi) => (
            <button
              key={kpi.key || 'healthy'}
              type="button"
              className={`mob-kpi ${db.filters.type === kpi.key && kpi.key ? 'mob-kpi--active' : ''} mob-kpi--${kpi.color}`}
              onClick={() => kpi.key && db.setFilterByType(kpi.key)}
            >
              <span className="material-symbols-outlined mob-kpi__icon">{kpi.icon}</span>
              <span className="mob-kpi__value">{kpi.value}</span>
              <span className="mob-kpi__label">{kpi.label}</span>
            </button>
          ))}
        </div>

        {/* ── Active Filters ───────────────────────────────────────── */}
        {db.activeFilterCount > 0 && (
          <div className="mob-active-filters">
            <span className="mob-active-filters__text">
              Filtered: {db.filteredIssues.length} issue{db.filteredIssues.length !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              className="mob-active-filters__clear"
              onClick={db.clearFilters}
            >
              Clear
            </button>
          </div>
        )}

        {/* ── Issue Cards ──────────────────────────────────────────── */}
        <div className="mob-cards">
          {db.loading ? (
            <div className="mob-empty">
              <span className="material-symbols-outlined mob-spin" style={{ fontSize: 32 }}>sync</span>
              <p>Connecting...</p>
            </div>
          ) : db.filteredIssues.length > 0 ? (
            db.filteredIssues.map((issue) => (
              <IssueCard
                key={issue.id || issue.issue_key}
                issue={issue}
                expanded={expandedId === (issue.id || issue.issue_key)}
                onToggle={() =>
                  setExpandedId(
                    expandedId === (issue.id || issue.issue_key) ? null : (issue.id || issue.issue_key || null)
                  )
                }
                onResolve={() => void db.changeIssueStatus(issue, 'resolved')}
                onRerunCi={() => void db.handleRerunCi(issue)}
                onRequestReview={() => {
                  setReviewTarget(issue);
                  setReviewValue('');
                }}
                disabled={!!db.action}
              />
            ))
          ) : (
            <div className="mob-empty">
              <span className="material-symbols-outlined" style={{ fontSize: 36 }}>
                {db.activeFilterCount > 0 ? 'filter_list_off' : 'done_all'}
              </span>
              <p className="mob-empty__title">
                {db.activeFilterCount > 0 ? 'No matches' : 'All clear!'}
              </p>
              <p className="mob-empty__sub">
                {db.activeFilterCount > 0
                  ? 'Adjust filters or clear them.'
                  : 'No open PR risks detected.'}
              </p>
            </div>
          )}

          {/* ── Resolved Section ────────────────────────────────────── */}
          {!db.loading && db.resolvedIssues.length > 0 && (
            <>
              <div className="mob-section-divider">
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#10b981' }}>check_circle</span>
                <span>{db.resolvedIssues.length} Resolved</span>
              </div>
              {db.resolvedIssues.slice(0, 5).map((issue) => (
                <div key={issue.id || issue.issue_key} className="mob-resolved-card">
                  <TypeBadge type={issue.type} />
                  <div className="mob-resolved-card__info">
                    <span className="mob-resolved-card__title">{issue.title}</span>
                    <span className="mob-resolved-card__meta">{issue.repo} · @{issue.author || 'unknown'}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Bottom Action Dock ─────────────────────────────────────────── */}
      <nav className="mob-dock">
        <button
          type="button"
          className="mob-dock__btn"
          onClick={() => void db.runScan()}
          disabled={!!db.action || !db.activeRepos.length}
        >
          <span className="material-symbols-outlined">radar</span>
          <span>Scan</span>
        </button>
        <button
          type="button"
          className="mob-dock__btn"
          onClick={() => void db.refreshState()}
          disabled={!!db.action}
        >
          <span className="material-symbols-outlined">refresh</span>
          <span>Refresh</span>
        </button>
        <button
          type="button"
          className="mob-dock__btn"
          onClick={() => void db.discoverRepos()}
          disabled={!!db.action}
        >
          <span className="material-symbols-outlined">search</span>
          <span>Repos</span>
        </button>
        <a href="/org/settings" className="mob-dock__btn">
          <span className="material-symbols-outlined">settings</span>
          <span>Config</span>
        </a>
        <button
          type="button"
          className="mob-dock__btn mob-dock__btn--notif"
          onClick={() => db.setShowNotifications(!db.showNotifications)}
        >
          <span className="material-symbols-outlined">notifications</span>
          {db.resolvedIssues.length > 0 && (
            <span className="mob-dock__badge">{db.resolvedIssues.length > 9 ? '9+' : db.resolvedIssues.length}</span>
          )}
          <span>Activity</span>
        </button>
      </nav>

      {/* ── Overlays ──────────────────────────────────────────────────── */}
      <NotifSheet
        open={db.showNotifications}
        onClose={() => db.setShowNotifications(false)}
        openIssues={db.openIssues}
        resolvedIssues={db.resolvedIssues}
      />

      <ReviewModal
        open={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        onSubmit={handleReviewSubmit}
        value={reviewValue}
        onChange={setReviewValue}
      />

      <MenuDrawer
        open={showMenu}
        onClose={() => setShowMenu(false)}
        db={db}
      />
    </div>
  );
}

// ── Menu Drawer ─────────────────────────────────────────────────────────────

function MenuDrawer({
  open,
  onClose,
  db,
}: {
  open: boolean;
  onClose: () => void;
  db: ReturnType<typeof useDashboard>;
}) {
  if (!open) return null;

  const updateSetting = async (key: string, value: any) => {
    try {
      db.setNotice(null);
      const payload = {
        scan_interval: db.settings.scan_interval || 300,
        notify_in_app: db.settings.notify_in_app,
        auto_label_conflict: db.settings.auto_label_conflict,
        tag_author_on_fail: db.settings.tag_author_on_fail,
        slack_webhook: db.settings.slack_webhook || '',
        discord_webhook: db.settings.discord_webhook || '',
        [key]: value
      };
      await api.saveSettings(payload);
      await db.refreshState(true);
      db.setNotice('Settings saved successfully.');
    } catch (e: any) {
      db.setError(e.message || 'Failed to save settings.');
    }
  };

  return (
    <div className="mob-sheet-overlay" onClick={onClose}>
      <div className="mob-drawer-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mob-drawer-sheet__header">
          <div className="mob-drawer-sheet__user">
            <div className="mob-drawer-sheet__avatar">
              {(db.state.user?.name || db.state.user?.username || 'U')[0].toUpperCase()}
            </div>
            <div className="mob-drawer-sheet__user-info">
              <strong className="mob-drawer-sheet__name">
                {db.state.user?.name || db.state.user?.username || 'User'}
              </strong>
              <span className="mob-drawer-sheet__email">{db.state.user?.email || 'authenticated via GitHub'}</span>
            </div>
          </div>
          <button type="button" className="mob-drawer-sheet__close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="mob-drawer-sheet__content">
          <h4 className="mob-drawer-sheet__section-title">Workspace Settings</h4>
          <div className="mob-settings-list">
            <label className="mob-setting-row">
              <div className="mob-setting-row__info">
                <strong>In-App Notifications</strong>
                <span>Show desktop/mobile banners</span>
              </div>
              <input
                type="checkbox"
                className="mob-switch"
                checked={!!db.settings.notify_in_app}
                onChange={(e) => void updateSetting('notify_in_app', e.target.checked)}
              />
            </label>

            <label className="mob-setting-row">
              <div className="mob-setting-row__info">
                <strong>Auto-Label Conflicts</strong>
                <span>Add &apos;merge-conflict&apos; label in GitHub</span>
              </div>
              <input
                type="checkbox"
                className="mob-switch"
                checked={!!db.settings.auto_label_conflict}
                onChange={(e) => void updateSetting('auto_label_conflict', e.target.checked)}
              />
            </label>

            <label className="mob-setting-row">
              <div className="mob-setting-row__info">
                <strong>Tag Author on Failures</strong>
                <span>Mention author in PR comments</span>
              </div>
              <input
                type="checkbox"
                className="mob-switch"
                checked={!!db.settings.tag_author_on_fail}
                onChange={(e) => void updateSetting('tag_author_on_fail', e.target.checked)}
              />
            </label>
          </div>

          <h4 className="mob-drawer-sheet__section-title">Integrations</h4>
          <div className="mob-settings-list">
            <div className="mob-input-group">
              <label>Slack Webhook</label>
              <input
                type="text"
                className="mob-input-text"
                placeholder="https://hooks.slack.com/services/..."
                defaultValue={db.settings.slack_webhook || ''}
                onBlur={(e) => void updateSetting('slack_webhook', e.target.value)}
              />
            </div>
            <div className="mob-input-group">
              <label>Discord Webhook</label>
              <input
                type="text"
                className="mob-input-text"
                placeholder="https://discord.com/api/webhooks/..."
                defaultValue={db.settings.discord_webhook || ''}
                onBlur={(e) => void updateSetting('discord_webhook', e.target.value)}
              />
            </div>
          </div>

          <h4 className="mob-drawer-sheet__section-title">Account Actions</h4>
          <div className="mob-settings-list" style={{ gap: 12 }}>
            <a href="/logout" className="mob-btn mob-btn--logout">
              <span className="material-symbols-outlined">logout</span>
              Log Out
            </a>
            <button
              type="button"
              className="mob-btn mob-btn--danger"
              onClick={() => {
                onClose();
                void db.handleDeleteAccount();
              }}
            >
              <span className="material-symbols-outlined">delete_forever</span>
              Delete Workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
