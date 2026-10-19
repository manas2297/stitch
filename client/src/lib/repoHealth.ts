import {
  addDays,
  languageName,
  parseDateStr,
  toDateStr,
  type ContributionGraph,
  type GitHubWindow,
  type LocalRepoPulse,
} from './contributions';
import { isFocusRepo } from './focus';

export type RepoStatus = 'active' | 'cooling' | 'dormant' | 'missing' | 'unknown';

export const STATUS_META: Record<RepoStatus, { label: string; dot: string; text: string; rank: number }> = {
  active: { label: 'Active', dot: 'bg-success', text: 'text-success', rank: 0 },
  cooling: { label: 'Cooling', dot: 'bg-warning', text: 'text-warning', rank: 1 },
  dormant: { label: 'Dormant', dot: 'bg-muted-foreground/50', text: 'text-muted-foreground', rank: 2 },
  unknown: { label: 'GitHub only', dot: 'bg-muted-foreground/30', text: 'text-muted-foreground', rank: 3 },
  missing: { label: 'Missing', dot: 'bg-destructive', text: 'text-destructive', rank: 4 },
};

export const SPARK_WEEKS = 12;

/**
 * One project as the user thinks of it: a local clone and its GitHub repo are
 * tracked as separate config entries but shown as a single row.
 */
export interface RepoRow {
  key: string;
  name: string;
  slug?: string; // owner/name on GitHub
  path?: string;
  kind: 'local' | 'github' | 'both';
  entries: any[]; // underlying tracked config entries
  branch?: string;
  isMajor: boolean;
  isFocus: boolean;
  isExternal: boolean;
  status: RepoStatus;
  lastCommit?: string;
  weekly: number[] | null;
  /** Own commits since `since` (local), or GitHub's 30-day count for GitHub-only rows */
  commits: number | null;
  uncommitted: number;
  unpushed: number;
  hasUpstream: boolean;
  topLanguage?: string;
  focusValue: string;
  githubUrl?: string;
}

const NON_CODE = new Set(['Config', 'Markdown', 'Text', 'Other']);

function statusFor(exists: boolean, lastCommit?: string): RepoStatus {
  if (!exists) return 'missing';
  if (!lastCommit) return 'dormant';
  const days = (Date.now() - new Date(lastCommit).getTime()) / 86400000;
  return days <= 7 ? 'active' : days <= 30 ? 'cooling' : 'dormant';
}

export function buildRepoRows({
  repos,
  local,
  githubMonth,
  focusProject,
  currentUser,
  since,
}: {
  repos: any[];
  local: ContributionGraph | null;
  githubMonth?: GitHubWindow;
  focusProject: string;
  currentUser: string;
  since?: string;
}): RepoRow[] {
  const pulses: LocalRepoPulse[] = local?.repos ?? [];
  const commits = local?.commits ?? [];
  const today = toDateStr(new Date());
  const sparkStart = addDays(today, -(SPARK_WEEKS * 7 - 1));
  const sinceDate = since ?? addDays(today, -89);

  const weekly = pulses.map(() => Array(SPARK_WEEKS).fill(0));
  const recent = pulses.map(() => 0);
  const langs = pulses.map(() => new Map<string, number>());
  for (const c of commits) {
    if (!weekly[c.r]) continue;
    if (c.d >= sparkStart) {
      const w = Math.floor((parseDateStr(c.d).getTime() - parseDateStr(sparkStart).getTime()) / (7 * 86400000));
      if (w >= 0 && w < SPARK_WEEKS) weekly[c.r][w]++;
    }
    if (c.d >= sinceDate) recent[c.r]++;
    for (const [key, lines] of Object.entries(c.l ?? {})) {
      const name = languageName(key);
      langs[c.r].set(name, (langs[c.r].get(name) ?? 0) + lines);
    }
  }
  const topLanguage = (i: number) => {
    const ranked = Array.from(langs[i] ?? []).sort((a, b) => b[1] - a[1]);
    return (ranked.find(([n]) => !NON_CODE.has(n)) ?? ranked[0])?.[0];
  };
  const ghCounts = new Map((githubMonth?.byRepository ?? []).map((b) => [b.repository.nameWithOwner.toLowerCase(), b.contributions.totalCount]));
  const isExternal = (owner?: string) => !owner || !currentUser || owner.toLowerCase() !== currentUser.toLowerCase();

  // Local clones first, so a GitHub entry can attach to its clone.
  const rows: RepoRow[] = [];
  const bySlug = new Map<string, RepoRow>();

  for (const r of repos.filter((r) => r.type === 'local')) {
    const idx = pulses.findIndex((p) => p.path === r.path || p.path.endsWith(`/${r.path}`));
    const p = idx >= 0 ? pulses[idx] : undefined;
    const slug = r.owner && r.name ? `${r.owner}/${r.name}` : undefined;
    const row: RepoRow = {
      key: r.path,
      name: r.path.split('/').pop() || r.name,
      slug,
      path: r.path,
      kind: 'local',
      entries: [r],
      branch: r.branch,
      isMajor: !!r.isMajorProject,
      isFocus: isFocusRepo(r, focusProject),
      isExternal: isExternal(r.owner),
      status: statusFor(r.exists, p?.lastCommit),
      lastCommit: p?.lastCommit || undefined,
      weekly: idx >= 0 ? weekly[idx] : null,
      commits: idx >= 0 ? recent[idx] : null,
      uncommitted: p?.uncommitted ?? 0,
      unpushed: p?.unpushed ?? 0,
      hasUpstream: p?.hasUpstream ?? false,
      topLanguage: idx >= 0 ? topLanguage(idx) : undefined,
      focusValue: r.path,
      githubUrl: slug ? `https://github.com/${slug}` : undefined,
    };
    rows.push(row);
    if (slug && !bySlug.has(slug.toLowerCase())) bySlug.set(slug.toLowerCase(), row);
  }

  for (const r of repos.filter((r) => r.type !== 'local')) {
    const slug = `${r.owner}/${r.name}`;
    const clone = bySlug.get(slug.toLowerCase());
    if (clone) {
      clone.kind = 'both';
      clone.entries.push(r);
      clone.isMajor ||= !!r.isMajorProject;
      clone.isFocus ||= isFocusRepo(r, focusProject);
      continue;
    }
    const recentGh = ghCounts.get(slug.toLowerCase());
    rows.push({
      key: slug,
      name: r.name,
      slug,
      kind: 'github',
      entries: [r],
      isMajor: !!r.isMajorProject,
      isFocus: isFocusRepo(r, focusProject),
      isExternal: isExternal(r.owner),
      status: recentGh ? 'active' : 'unknown',
      weekly: null,
      commits: githubMonth ? (recentGh ?? 0) : null,
      uncommitted: 0,
      unpushed: 0,
      hasUpstream: true,
      focusValue: slug,
      githubUrl: `https://github.com/${slug}`,
    });
  }

  return rows;
}

/** Default ordering: health status, then Major first, then most recent work. */
export function compareRows(a: RepoRow, b: RepoRow) {
  return (
    STATUS_META[a.status].rank - STATUS_META[b.status].rank ||
    Number(b.isMajor) - Number(a.isMajor) ||
    (b.lastCommit ?? '').localeCompare(a.lastCommit ?? '') ||
    (b.commits ?? 0) - (a.commits ?? 0)
  );
}

export function statusCounts(rows: RepoRow[]) {
  const counts: Record<RepoStatus, number> = { active: 0, cooling: 0, dormant: 0, unknown: 0, missing: 0 };
  for (const r of rows) counts[r.status]++;
  return counts;
}

export const hasUnsavedWork = (r: RepoRow) => r.uncommitted > 0 || r.unpushed > 0;
