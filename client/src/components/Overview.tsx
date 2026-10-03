import { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Star,
  GitPullRequest,
  AlertCircle,
  Flame,
  Search,
  Target,
  GitBranch,
  ArrowRight,
  Trophy,
  GitGraph,
  GitCommit,
  CheckCircle2,
  Check,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Laptop,
  Globe,
  Filter,
  ExternalLink,
} from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { useToast } from './Toast';
import { StatCard } from './ui/StatCard';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';

const ROWS_PER_PAGE = 8;

function TableSkeletonRows({ cols = 5, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c}>
              <div
                className="skeleton skeleton-line"
                style={{
                  height: 12,
                  width: c === 0 ? '75%' : '50%',
                  borderRadius: 4,
                  margin: 0,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function ageBadge(dateStr: string) {
  const days = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  if (days < 2)  return { cls: 'age-fresh',  label: 'Today' };
  if (days < 7)  return { cls: 'age-recent', label: `${Math.floor(days)}d ago` };
  if (days < 30) return { cls: 'age-aging',  label: `${Math.floor(days)}d ago` };
  return           { cls: 'age-stale',  label: `${Math.floor(days / 30)}mo ago` };
}

interface ContributionDay {
  date: string;
  contributionCount: number;
  color?: string;
}

interface ContributionWeek {
  contributionDays: ContributionDay[];
}

function computeStreaks(weeks?: ContributionWeek[]) {
  if (!weeks) return { current: 0, longest: 0 };
  const allDays: ContributionDay[] = [];
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

function computeMonthLabels(weeks?: ContributionWeek[]) {
  if (!weeks) return [];
  const labels: string[] = [];
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



// ── Sub-components ─────────────────────────────────────────────────────────

function ReviewBadge({ decision }: { decision?: string }) {
  if (!decision) return null;
  const map: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    APPROVED: {
      label: 'Approved',
      icon: <Check size={12} style={{ marginRight: 4 }} />,
      cls: 'review-badge-approved',
    },
    CHANGES_REQUESTED: {
      label: 'Changes',
      icon: <AlertTriangle size={12} style={{ marginRight: 4 }} />,
      cls: 'review-badge-changes',
    },
    REVIEW_REQUIRED: {
      label: 'Review',
      icon: <Clock size={12} style={{ marginRight: 4 }} />,
      cls: 'review-badge-review',
    },
  };
  const b = map[decision];
  if (!b) return null;
  return (
    <span className={`review-badge ${b.cls}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
      {b.icon}
      {b.label}
    </span>
  );
}

function Pagination({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination-controls">
      <button
        className="pagination-btn"
        onClick={onPrev}
        disabled={page === 0}
        aria-label="Previous page"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        <ChevronLeft size={14} /> Prev
      </button>
      <div className="pagination-info">
        {totalPages <= 8
          ? Array.from({ length: totalPages }, (_, i) => (
              <div key={i} className={`pagination-dot ${i === page ? 'active' : ''}`} />
            ))
          : <span>{page + 1} / {totalPages}</span>
        }
      </div>
      <button
        className="pagination-btn"
        onClick={onNext}
        disabled={page >= totalPages - 1}
        aria-label="Next page"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        Next <ChevronRight size={14} />
      </button>
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

  const [activeGraph, setActiveGraph]   = useState('github');
  const [selectedRepo, setSelectedRepo] = useState<string>('all');
  const [activityTab, setActivityTab]   = useState<'prs' | 'issues'>('prs');
  const [tablePage, setTablePage]       = useState(0);

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

  // Activity list & repo filtering
  const prs    = data?.prs ?? [];
  const issues = data?.issues ?? [];

  const repoOptions = useMemo(() => {
    const names = new Set<string>();
    repos.forEach(r => names.add(r.name));
    prs.forEach(p => { if (p.repository?.name) names.add(p.repository.name); });
    issues.forEach(i => { if (i.repository?.name) names.add(i.repository.name); });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [repos, prs, issues]);

  const filteredPrs = useMemo(() => {
    if (selectedRepo === 'all') return prs;
    return prs.filter(p => p.repository?.name?.toLowerCase() === selectedRepo.toLowerCase());
  }, [prs, selectedRepo]);

  const filteredIssues = useMemo(() => {
    if (selectedRepo === 'all') return issues;
    return issues.filter(i => i.repository?.name?.toLowerCase() === selectedRepo.toLowerCase());
  }, [issues, selectedRepo]);

  const activeItems   = activityTab === 'prs' ? filteredPrs : filteredIssues;
  const totalPages    = Math.max(1, Math.ceil(activeItems.length / ROWS_PER_PAGE));
  const pageStart     = tablePage * ROWS_PER_PAGE;
  const pageEnd       = Math.min(pageStart + ROWS_PER_PAGE, activeItems.length);
  const visibleItems  = activeItems.slice(pageStart, pageEnd);

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
            <span className="focus-mini-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target size={20} />
            </span>
            <div>
              <div className="focus-mini-label">Current Focus</div>
              <div className="focus-mini-name">
                {focusProject.includes('/') ? `${focusRepo.owner}/${focusRepo.name}` : focusRepo.name}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {focusRepo.branch && (
              <span className="focus-mini-branch" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <GitBranch size={13} /> {focusRepo.branch}
              </span>
            )}
            <span className="focus-mini-jump" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Open <ArrowRight size={13} />
            </span>
          </div>
        </div>
      )}

      {/* ── Contribution Calendar ───────────────────────────────────────── */}
      <div className="contrib-calendar-container">
        <div className="contrib-calendar-header">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              <Flame size={15} style={{ color: '#f59e0b' }} /> Consistency &amp; Activity
            </h3>
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', padding: 3, borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <button
                className={`inner-tab ${activeGraph === 'github' ? 'active' : ''}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: '0.75rem', borderRadius: 6 }}
                onClick={() => setActiveGraph('github')}
              >
                <GitGraph size={12} /> GitHub Graph
              </button>
              <button
                className={`inner-tab ${activeGraph === 'local' ? 'active' : ''}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: '0.75rem', borderRadius: 6 }}
                onClick={() => setActiveGraph('local')}
              >
                <GitCommit size={12} /> Local Commits
              </button>
            </div>
            {!isGraphLoading && currentGraph?.weeks && (
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="streak-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Flame size={12} /> {streaks.current}d streak
                </span>
                <span className="streak-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(139,155,180,0.08)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                  <Trophy size={12} /> {streaks.longest}d best
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

      {/* ── Global Stats — 6 cards using standard StatCard ───────────────── */}
      <div className="overview-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <StatCard
          icon={Package}
          variant="purple"
          value={totalRepoCount}
          label="GitHub Repos"
          sublabel={trackedCount < totalRepoCount ? `${trackedCount} tracked` : undefined}
        />
        <StatCard
          icon={Star}
          variant="green"
          value={majorRepos.length}
          label="Major Projects"
        />
        <StatCard
          icon={GitPullRequest}
          variant="blue"
          value={loading ? '—' : prs.length}
          label="Open PRs"
        />
        <StatCard
          icon={AlertCircle}
          variant="orange"
          value={loading ? '—' : issues.length}
          label="Open Issues"
        />
        <StatCard
          icon={Flame}
          variant="teal"
          value={isGraphLoading ? '—' : streaks.current}
          label="Day Streak"
          sublabel={!isGraphLoading && streaks.longest > 0 ? `best: ${streaks.longest}d` : undefined}
        />
        <StatCard
          icon={Search}
          variant="pink"
          value={loading ? '—' : prs.length}
          label="Review Requests"
        />
      </div>

      {/* ── Tabular Activity Section: PRs & Issues ──────────────────────── */}
      <div className="activity-tabular-card">
        {/* Toolbar */}
        <div className="activity-toolbar">
          <div className="activity-tab-group">
            <button
              type="button"
              className={`activity-tab-btn ${activityTab === 'prs' ? 'active' : ''}`}
              onClick={() => { setActivityTab('prs'); setTablePage(0); }}
            >
              <GitPullRequest size={15} />
              <span>Pull Requests</span>
              {!loading && (
                <Badge variant={activityTab === 'prs' ? 'blue' : 'default'} style={{ fontSize: '0.7rem' }}>
                  {filteredPrs.length}
                </Badge>
              )}
            </button>
            <button
              type="button"
              className={`activity-tab-btn ${activityTab === 'issues' ? 'active' : ''}`}
              onClick={() => { setActivityTab('issues'); setTablePage(0); }}
            >
              <AlertCircle size={15} />
              <span>Issues</span>
              {!loading && (
                <Badge variant={activityTab === 'issues' ? 'orange' : 'default'} style={{ fontSize: '0.7rem' }}>
                  {filteredIssues.length}
                </Badge>
              )}
            </button>
          </div>

          <div className="activity-filter-box">
            <Filter size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              value={selectedRepo}
              onChange={(e) => {
                setSelectedRepo(e.target.value);
                setTablePage(0);
              }}
              className="activity-repo-select"
              aria-label="Filter by repository"
            >
              <option value="all">All Repositories ({repoOptions.length})</option>
              {repoOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="activity-table-wrapper">
            <table className="activity-table">
              <thead>
                <tr>
                  <th style={{ width: activityTab === 'prs' ? '42%' : '48%' }}>
                    {activityTab === 'prs' ? 'Pull Request' : 'Issue'}
                  </th>
                  <th style={{ width: activityTab === 'prs' ? '18%' : '22%' }}>Repository</th>
                  {activityTab === 'prs' && <th style={{ width: '14%' }}>Author</th>}
                  {activityTab === 'prs' && <th style={{ width: '14%' }}>Review</th>}
                  {activityTab === 'issues' && <th style={{ width: '18%' }}>Labels</th>}
                  <th style={{ width: '12%', textAlign: 'right' }}>Created</th>
                </tr>
              </thead>
              <tbody>
                <TableSkeletonRows cols={activityTab === 'prs' ? 5 : 4} rows={ROWS_PER_PAGE} />
              </tbody>
            </table>
          </div>
        ) : activeItems.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={activityTab === 'prs' ? 'No pull requests found' : 'No issues found'}
            description={
              selectedRepo === 'all'
                ? `All clear! No open ${activityTab === 'prs' ? 'pull requests' : 'issues'} across your repositories.`
                : `No open ${activityTab === 'prs' ? 'pull requests' : 'issues'} found for repository "${selectedRepo}".`
            }
          />
        ) : (
          <div className="activity-table-wrapper">
            <table className="activity-table">
              <thead>
                <tr>
                  <th style={{ width: activityTab === 'prs' ? '40%' : '46%' }}>
                    {activityTab === 'prs' ? 'Pull Request' : 'Issue'}
                  </th>
                  <th style={{ width: activityTab === 'prs' ? '18%' : '22%' }}>Repository</th>
                  {activityTab === 'prs' && <th style={{ width: '14%' }}>Author</th>}
                  {activityTab === 'prs' && <th style={{ width: '14%' }}>Review</th>}
                  {activityTab === 'issues' && <th style={{ width: '20%' }}>Labels</th>}
                  <th style={{ width: '14%', textAlign: 'right' }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {activityTab === 'prs'
                  ? visibleItems.map((pr: any, i: number) => {
                      const age = ageBadge(pr.createdAt);
                      return (
                        <tr key={`${pr.number}-${i}`}>
                          <td>
                            <div className="activity-title-cell">
                              <span className="pr-number-badge">#{pr.number}</span>
                              <a
                                href={pr.url}
                                target="_blank"
                                rel="noreferrer"
                                className="activity-title-link"
                                title={pr.title}
                              >
                                {pr.title}
                              </a>
                              <a
                                href={pr.url}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: 'var(--text-muted)', display: 'inline-flex', flexShrink: 0 }}
                                title="Open in GitHub"
                              >
                                <ExternalLink size={13} />
                              </a>
                            </div>
                            {pr.labels && pr.labels.length > 0 && (
                              <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                                {pr.labels.slice(0, 3).map((l: any, j: number) => (
                                  <span key={j} className="activity-label">{l.name}</span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td>
                            {pr.repository?.name ? (
                              <Badge variant="blue" style={{ fontSize: '0.72rem' }}>
                                {pr.repository.name}
                              </Badge>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                          <td>
                            {pr.author?.login ? (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                @{pr.author.login}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                          <td>
                            {pr.reviewDecision ? (
                              <ReviewBadge decision={pr.reviewDecision} />
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>None</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <span className={`age-badge ${age.cls}`}>{age.label}</span>
                          </td>
                        </tr>
                      );
                    })
                  : visibleItems.map((issue: any, i: number) => {
                      const age = ageBadge(issue.createdAt);
                      return (
                        <tr key={`${issue.number}-${i}`}>
                          <td>
                            <div className="activity-title-cell">
                              <span className="issue-number-badge">#{issue.number}</span>
                              <a
                                href={issue.url}
                                target="_blank"
                                rel="noreferrer"
                                className="activity-title-link"
                                title={issue.title}
                              >
                                {issue.title}
                              </a>
                              <a
                                href={issue.url}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: 'var(--text-muted)', display: 'inline-flex', flexShrink: 0 }}
                                title="Open in GitHub"
                              >
                                <ExternalLink size={13} />
                              </a>
                            </div>
                          </td>
                          <td>
                            {issue.repository?.name ? (
                              <Badge variant="orange" style={{ fontSize: '0.72rem' }}>
                                {issue.repository.name}
                              </Badge>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                          <td>
                            {issue.labels && issue.labels.length > 0 ? (
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {issue.labels.slice(0, 3).map((l: any, j: number) => (
                                  <span key={j} className="activity-label">{l.name}</span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <span className={`age-badge ${age.cls}`}>{age.label}</span>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && activeItems.length > 0 && (
          <div className="activity-table-footer">
            <span className="activity-table-count">
              Showing <strong>{pageStart + 1}</strong>–<strong>{pageEnd}</strong> of <strong>{activeItems.length}</strong> {activityTab === 'prs' ? 'pull requests' : 'issues'}
            </span>
            {totalPages > 1 && (
              <Pagination
                page={tablePage}
                totalPages={totalPages}
                onPrev={() => setTablePage((p) => Math.max(0, p - 1))}
                onNext={() => setTablePage((p) => Math.min(totalPages - 1, p + 1))}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Repo breakdown ───────────────────────────────────────────────── */}
      <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="overview-panel">
          <div className="overview-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Laptop size={16} /> Local Repos ({localRepos.length})
          </div>
          {localRepos.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>None added yet.</div>
          ) : localRepos.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < localRepos.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
              <div>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{r.name}</span>
                {r.branch && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 8, fontFamily: 'monospace' }}>
                    <GitBranch size={11} /> {r.branch}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {r.isMajorProject && (
                  <Badge variant="green" style={{ fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <Star size={10} /> Major
                  </Badge>
                )}
                {!r.exists && <Badge variant="orange" style={{ fontSize: '0.65rem' }}>Missing</Badge>}
              </div>
            </div>
          ))}
        </div>

        <div className="overview-panel">
          <div className="overview-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={16} /> Web Repos ({webRepos.length})
          </div>
          {webRepos.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>None added yet.</div>
          ) : webRepos.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < webRepos.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{r.owner}/{r.name}</span>
              {r.isMajorProject && (
                <Badge variant="green" style={{ fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <Star size={10} /> Major
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
