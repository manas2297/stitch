import { useState, useEffect, useMemo } from 'react';
import useAppStore from '../store/useAppStore';
import { useToast } from './Toast';

const ITEMS_PER_PAGE = 4;

// ── Helpers ────────────────────────────────────────────────────────────────

function ageBadge(dateStr) {
  const days = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  if (days < 2)  return { cls: 'age-fresh',  label: 'Today' };
  if (days < 7)  return { cls: 'age-recent', label: `${Math.floor(days)}d ago` };
  if (days < 30) return { cls: 'age-aging',  label: `${Math.floor(days)}d ago` };
  return           { cls: 'age-stale',  label: `${Math.floor(days / 30)}mo ago` };
}

function computeStreaks(weeks) {
  if (!weeks) return { current: 0, longest: 0 };
  const allDays = [];
  for (const week of weeks)
    for (const day of week.contributionDays) allDays.push(day);
  allDays.sort((a, b) => a.date.localeCompare(b.date));

  let longest = 0, temp = 0;
  for (const day of allDays) {
    if (day.contributionCount > 0) { temp++; longest = Math.max(longest, temp); }
    else temp = 0;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const pastDays = allDays.filter(d => d.date <= todayStr).reverse();
  let current = 0, i = 0;
  if (pastDays.length > 0 && pastDays[0].date === todayStr && pastDays[0].contributionCount === 0) i = 1;
  for (; i < pastDays.length; i++) {
    if (pastDays[i].contributionCount > 0) current++;
    else break;
  }
  return { current, longest };
}

function computeMonthLabels(weeks) {
  if (!weeks) return [];
  const labels = [];
  let lastMonth = -1;
  for (const week of weeks) {
    if (!week.contributionDays.length) { labels.push(''); continue; }
    const d = new Date(week.contributionDays[0].date);
    const m = d.getMonth();
    if (m !== lastMonth) {
      labels.push(d.toLocaleDateString(undefined, { month: 'short' }));
      lastMonth = m;
    } else {
      labels.push('');
    }
  }
  return labels;
}

function prAccentColor(decision) {
  return {
    APPROVED:          '#34d399',
    CHANGES_REQUESTED: '#fbbf24',
    REVIEW_REQUIRED:   'rgba(139,155,180,0.35)',
  }[decision] ?? 'rgba(139,155,180,0.2)';
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ReviewBadge({ decision }) {
  if (!decision) return null;
  const map = {
    APPROVED:          { label: '✓ Approved', cls: 'review-badge-approved' },
    CHANGES_REQUESTED: { label: '△ Changes',  cls: 'review-badge-changes'  },
    REVIEW_REQUIRED:   { label: '◎ Review',   cls: 'review-badge-review'   },
  };
  const b = map[decision];
  if (!b) return null;
  return <span className={`review-badge ${b.cls}`}>{b.label}</span>;
}

function PrCard({ pr }) {
  const age = ageBadge(pr.createdAt);
  const accent = prAccentColor(pr.reviewDecision);
  return (
    <a href={pr.url} target="_blank" rel="noreferrer" className="activity-card pr-card">
      {/* Top row: repo chip + number */}
      <div className="activity-card-top">
        {pr.repository?.name
          ? <span className="activity-repo-chip">{pr.repository.name}</span>
          : <span />
        }
        <span className="activity-card-num">#{pr.number}</span>
      </div>

      {/* Title with left accent bar */}
      <div className="activity-card-title" style={{ borderLeftColor: accent }}>
        {pr.title}
      </div>

      {/* Meta row */}
      <div className="activity-card-meta">
        {pr.author?.login && (
          <span className="activity-author">@{pr.author.login}</span>
        )}
        <span className="activity-meta-sep">·</span>
        <span className={`age-badge ${age.cls}`}>{age.label}</span>
        {pr.reviewDecision && (
          <>
            <span className="activity-meta-sep">·</span>
            <ReviewBadge decision={pr.reviewDecision} />
          </>
        )}
        {pr.labels?.slice(0, 2).map((l, j) => (
          <span key={j} className="activity-label">{l.name}</span>
        ))}
      </div>
    </a>
  );
}

function IssueCard({ issue }) {
  const age = ageBadge(issue.createdAt);
  return (
    <a href={issue.url} target="_blank" rel="noreferrer" className="activity-card issue-card">
      {/* Top row: repo chip + number */}
      <div className="activity-card-top">
        {issue.repository?.name
          ? <span className="activity-repo-chip">{issue.repository.name}</span>
          : <span />
        }
        <span className="activity-card-num">#{issue.number}</span>
      </div>

      {/* Title */}
      <div className="activity-card-title issue-title">
        {issue.title}
      </div>

      {/* Meta row */}
      <div className="activity-card-meta">
        <span className={`age-badge ${age.cls}`}>{age.label}</span>
        {issue.labels?.slice(0, 3).map((l, j) => (
          <span key={j} className="activity-label">{l.name}</span>
        ))}
      </div>
    </a>
  );
}

function Pagination({ page, totalPages, onPrev, onNext }) {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination-controls">
      <button className="pagination-btn" onClick={onPrev} disabled={page === 0}>
        ← Prev
      </button>
      <div className="pagination-info">
        {totalPages <= 8
          ? Array.from({ length: totalPages }, (_, i) => (
              <div key={i} className={`pagination-dot ${i === page ? 'active' : ''}`} />
            ))
          : <span>{page + 1} / {totalPages}</span>
        }
      </div>
      <button className="pagination-btn" onClick={onNext} disabled={page >= totalPages - 1}>
        Next →
      </button>
    </div>
  );
}

function SkeletonCards({ rows = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="activity-card-skeleton">
          <div className="skeleton skeleton-line" style={{ height: 10, width: '35%', marginBottom: 8 }} />
          <div className="skeleton skeleton-line full" style={{ height: 14, marginBottom: 6 }} />
          <div className="skeleton skeleton-line" style={{ height: 10, width: '55%' }} />
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function Overview() {
  useToast();
  const repos           = useAppStore(s => s.repos);
  const githubRepoCount = useAppStore(s => s.githubRepoCount);
  const focusProject    = useAppStore(s => s.focusProject);
  const setActiveTab    = useAppStore(s => s.setActiveTab);

  const data            = useAppStore(s => s.overviewRecents);
  const contributions   = useAppStore(s => s.overviewContributions);
  const localContribs   = useAppStore(s => s.overviewLocalContributions);

  const loading         = !data;
  const loadingContribs = !contributions;
  const loadingLocal     = !localContribs;

  const [activeGraph, setActiveGraph]         = useState('github');
  const [prPage, setPrPage]                   = useState(0);
  const [issuePage, setIssuePage]             = useState(0);

  useEffect(() => {
    useAppStore.getState().loadOverviewData();
  }, []);

  // Derived values
  const majorRepos     = repos.filter(r => r.isMajorProject);
  const localRepos     = repos.filter(r => r.type === 'local');
  const webRepos       = repos.filter(r => r.type !== 'local');
  const totalRepoCount = githubRepoCount > 0 ? githubRepoCount : repos.length;
  const trackedCount   = repos.length;

  const currentGraph   = activeGraph === 'github' ? contributions : localContribs;
  const isGraphLoading = activeGraph === 'github' ? loadingContribs : loadingLocal;

  const streaks     = useMemo(() => computeStreaks(currentGraph?.weeks), [currentGraph]);
  const monthLabels = useMemo(() => computeMonthLabels(currentGraph?.weeks), [currentGraph]);

  // Pagination
  const prs            = data?.prs ?? [];
  const issues         = data?.issues ?? [];
  const prTotalPages   = Math.max(1, Math.ceil(prs.length / ITEMS_PER_PAGE));
  const issTotalPages  = Math.max(1, Math.ceil(issues.length / ITEMS_PER_PAGE));
  const visiblePrs     = prs.slice(prPage * ITEMS_PER_PAGE, (prPage + 1) * ITEMS_PER_PAGE);
  const visibleIssues  = issues.slice(issuePage * ITEMS_PER_PAGE, (issuePage + 1) * ITEMS_PER_PAGE);

  // Focus project
  const focusRepo = focusProject
    ? repos.find(r =>
        focusProject.includes('/')
          ? `${r.owner}/${r.name}` === focusProject
          : r.path === focusProject
      )
    : null;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="section-content active" id="overview-section">
      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <div className="section-title">
          <h2>Overview</h2>
          <div className="section-desc">Your repository workspace at a glance.</div>
        </div>
      </div>

      {/* ── Focus Project mini-card ─────────────────────────────────────── */}
      {focusRepo && (
        <div
          className="focus-mini-card"
          onClick={() => setActiveTab('focus')}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && setActiveTab('focus')}
        >
          <div className="focus-mini-left">
            <span className="focus-mini-icon">🎯</span>
            <div>
              <div className="focus-mini-label">Current Focus</div>
              <div className="focus-mini-name">
                {focusProject.includes('/') ? `${focusRepo.owner}/${focusRepo.name}` : focusRepo.name}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {focusRepo.branch && <span className="focus-mini-branch">⎇ {focusRepo.branch}</span>}
            <span className="focus-mini-jump">Open →</span>
          </div>
        </div>
      )}

      {/* ── Contribution Calendar ───────────────────────────────────────── */}
      <div className="contrib-calendar-container">
        <div className="contrib-calendar-header">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              🔥 Consistency &amp; Activity
            </h3>
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', padding: 3, borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <button className={`inner-tab ${activeGraph === 'github' ? 'active' : ''}`} style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: 6 }} onClick={() => setActiveGraph('github')}>
                GitHub Graph
              </button>
              <button className={`inner-tab ${activeGraph === 'local' ? 'active' : ''}`} style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: 6 }} onClick={() => setActiveGraph('local')}>
                Local Commits
              </button>
            </div>
            {!isGraphLoading && currentGraph?.weeks && (
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="streak-badge">🔥 {streaks.current}d streak</span>
                <span className="streak-badge" style={{ background: 'rgba(139,155,180,0.08)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                  🏆 {streaks.longest}d best
                </span>
              </div>
            )}
          </div>
          {!isGraphLoading && currentGraph && (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {activeGraph === 'github'
                ? <><strong>{currentGraph.total}</strong> contributions · <strong>@{currentGraph.username}</strong></>
                : <><strong>{currentGraph.total}</strong> local commits this year</>
              }
            </span>
          )}
        </div>

        {isGraphLoading ? (
          <div style={{ height: 90, display: 'flex', alignItems: 'center' }}>
            <div className="skeleton skeleton-line medium" style={{ height: 12 }} />
          </div>
        ) : currentGraph?.weeks ? (
          <>
            <div className="contrib-calendar-grid-wrapper">
              <div className="contrib-days-labels">
                <span /><span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="contrib-month-labels">
                  {monthLabels.map((label, i) => (
                    <div key={i} className="contrib-month-label-cell">{label}</div>
                  ))}
                </div>
                <div className="contrib-calendar-weeks">
                  {currentGraph.weeks.map((week, wIdx) => (
                    <div key={wIdx} className="contrib-calendar-week">
                      {week.contributionDays.map((day, dIdx) => (
                        <div
                          key={dIdx}
                          className="contrib-calendar-day"
                          style={{ backgroundColor: day.color }}
                          data-tooltip={`${day.contributionCount} ${activeGraph === 'github' ? 'contributions' : 'commits'} on ${new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="contrib-legend">
              <span className="contrib-legend-label">Less</span>
              {[
                'rgba(255,255,255,0.04)',
                '#0e4429',
                '#006d32',
                '#26a641',
                '#39d353',
              ].map((c, i) => <div key={i} className="contrib-legend-cell" style={{ backgroundColor: c }} />)}
              <span className="contrib-legend-label">More</span>
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>
            Contribution graph unavailable. Ensure your git config is set or GitHub CLI is authenticated.
          </div>
        )}
      </div>

      {/* ── Global Stats — 6 cards ──────────────────────────────────────── */}
      <div className="overview-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <div className="overview-stat-card purple">
          <div className="overview-stat-icon">📦</div>
          <div className="overview-stat-val">{totalRepoCount}</div>
          <div className="overview-stat-label">GitHub Repos</div>
          {trackedCount < totalRepoCount && (
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>{trackedCount} tracked</div>
          )}
        </div>
        <div className="overview-stat-card green">
          <div className="overview-stat-icon">⭐</div>
          <div className="overview-stat-val">{majorRepos.length}</div>
          <div className="overview-stat-label">Major Projects</div>
        </div>
        <div className="overview-stat-card blue">
          <div className="overview-stat-icon">⤳</div>
          <div className="overview-stat-val">{loading ? '—' : prs.length}</div>
          <div className="overview-stat-label">Open PRs</div>
        </div>
        <div className="overview-stat-card orange">
          <div className="overview-stat-icon">⚠</div>
          <div className="overview-stat-val">{loading ? '—' : issues.length}</div>
          <div className="overview-stat-label">Open Issues</div>
        </div>
        <div className="overview-stat-card teal">
          <div className="overview-stat-icon">🔥</div>
          <div className="overview-stat-val">{isGraphLoading ? '—' : streaks.current}</div>
          <div className="overview-stat-label">Day Streak</div>
          {!isGraphLoading && streaks.longest > 0 && (
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>best: {streaks.longest}d</div>
          )}
        </div>
        <div className="overview-stat-card pink">
          <div className="overview-stat-icon">🔍</div>
          <div className="overview-stat-val">{loading ? '—' : prs.length}</div>
          <div className="overview-stat-label">Review Requests</div>
        </div>
      </div>

      {/* ── Activity panels: PRs + Issues ───────────────────────────────── */}
      <div className="overview-two-col">

        {/* Pull Requests panel */}
        <div className="overview-panel activity-panel">
          {/* Panel header */}
          <div className="activity-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="activity-panel-icon pr-icon">⤳</span>
              <span className="activity-panel-title">Pull Requests</span>
            </div>
            {!loading && prs.length > 0 && (
              <span className="activity-count-badge">{prs.length} open</span>
            )}
          </div>

          {/* Items */}
          <div className="activity-items">
            {loading ? (
              <SkeletonCards rows={ITEMS_PER_PAGE} />
            ) : !prs.length ? (
              <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                <div className="empty-state-icon">🎉</div>
                <div className="empty-state-title">All clear!</div>
                <div className="empty-state-desc">No open pull requests across your repos.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {visiblePrs.map((pr, i) => <PrCard key={`${pr.number}-${i}`} pr={pr} />)}
              </div>
            )}
          </div>

          {/* Pagination */}
          {!loading && prs.length > ITEMS_PER_PAGE && (
            <Pagination
              page={prPage}
              totalPages={prTotalPages}
              onPrev={() => setPrPage(p => Math.max(0, p - 1))}
              onNext={() => setPrPage(p => Math.min(prTotalPages - 1, p + 1))}
            />
          )}
        </div>

        {/* Issues panel */}
        <div className="overview-panel activity-panel">
          {/* Panel header */}
          <div className="activity-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="activity-panel-icon issue-icon">⚠</span>
              <span className="activity-panel-title">Issues</span>
            </div>
            {!loading && issues.length > 0 && (
              <span className="activity-count-badge">{issues.length} open</span>
            )}
          </div>

          {/* Items */}
          <div className="activity-items">
            {loading ? (
              <SkeletonCards rows={ITEMS_PER_PAGE} />
            ) : !issues.length ? (
              <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                <div className="empty-state-icon">✅</div>
                <div className="empty-state-title">No open issues</div>
                <div className="empty-state-desc">Your repos are looking healthy.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {visibleIssues.map((issue, i) => <IssueCard key={`${issue.number}-${i}`} issue={issue} />)}
              </div>
            )}
          </div>

          {/* Pagination */}
          {!loading && issues.length > ITEMS_PER_PAGE && (
            <Pagination
              page={issuePage}
              totalPages={issTotalPages}
              onPrev={() => setIssuePage(p => Math.max(0, p - 1))}
              onNext={() => setIssuePage(p => Math.min(issTotalPages - 1, p + 1))}
            />
          )}
        </div>
      </div>

      {/* ── Repo breakdown ───────────────────────────────────────────────── */}
      <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="overview-panel">
          <div className="overview-panel-title"><span>💻</span> Local Repos ({localRepos.length})</div>
          {localRepos.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>None added yet.</div>
          ) : localRepos.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < localRepos.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
              <div>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{r.name}</span>
                {r.branch && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 8, fontFamily: 'monospace' }}>⎇ {r.branch}</span>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {r.isMajorProject && <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>⭐</span>}
                {!r.exists && <span className="badge badge-orange" style={{ fontSize: '0.65rem' }}>Missing</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="overview-panel">
          <div className="overview-panel-title"><span>🌐</span> Web Repos ({webRepos.length})</div>
          {webRepos.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>None added yet.</div>
          ) : webRepos.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < webRepos.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{r.owner}/{r.name}</span>
              {r.isMajorProject && <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>⭐</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
