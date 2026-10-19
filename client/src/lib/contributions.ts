export interface ContributionDay {
  date: string;
  contributionCount: number;
  color?: string;
}

export interface ContributionWeek {
  contributionDays: ContributionDay[];
}

/** One of the user's own local commits (keys kept short by the API). */
export interface LocalCommit {
  d: string; // YYYY-MM-DD, local clock
  h: number; // hour 0-23
  r: number; // index into LocalGraph.repos
  a: number; // lines added
  x: number; // lines deleted
  l?: Record<string, number>; // lines changed per language key
}

export interface LocalRepoPulse {
  name: string;
  path: string;
  lastCommit: string;
  uncommitted: number;
  unpushed: number;
  hasUpstream: boolean;
}

export interface GitHubWindow {
  commits: number;
  pullRequests: number;
  reviews: number;
  issues: number;
  repositories: number;
  private: number;
  byRepository: {
    repository: { nameWithOwner: string; name: string; url: string; isPrivate: boolean };
    contributions: { totalCount: number };
  }[];
}

export interface ContributionGraph {
  weeks?: ContributionWeek[];
  total?: number;
  username?: string;
  windows?: Record<RangeKey, GitHubWindow>;
  commits?: LocalCommit[];
  repos?: LocalRepoPulse[];
}

export type RangeKey = '30' | '90' | '365';

export const RANGES: Record<RangeKey, { days: number; short: string; long: string }> = {
  '30': { days: 30, short: '30D', long: 'last 30 days' },
  '90': { days: 90, short: '3M', long: 'last 3 months' },
  '365': { days: 365, short: '1Y', long: 'last year' },
};

// ── Dates (always local calendar days, never UTC) ─────────────────────────

export function toDateStr(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseDateStr(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number) {
  const d = parseDateStr(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function formatDay(s: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  return parseDateStr(s).toLocaleDateString(undefined, opts);
}

// ── Day series ────────────────────────────────────────────────────────────

export function countsByDate(weeks?: ContributionWeek[]) {
  const map = new Map<string, number>();
  for (const week of weeks ?? []) for (const day of week.contributionDays) map.set(day.date, day.contributionCount);
  return map;
}

export function computeStreaks(weeks?: ContributionWeek[]) {
  const counts = countsByDate(weeks);
  if (counts.size === 0) return { current: 0, longest: 0 };
  const dates = Array.from(counts.keys()).sort();

  let longest = 0;
  let run = 0;
  for (const d of dates) {
    run = (counts.get(d) ?? 0) > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }

  // A quiet today doesn't break the streak yet — the day isn't over.
  let day = toDateStr(new Date());
  if (!counts.get(day)) day = addDays(day, -1);
  let current = 0;
  while ((counts.get(day) ?? 0) > 0) {
    current++;
    day = addDays(day, -1);
  }
  return { current, longest };
}

export interface DayPoint {
  date: string;
  count: number;
}

export interface RangeStats {
  days: DayPoint[];
  start: string;
  end: string;
  total: number;
  /** null when the data doesn't reach back a full previous period */
  prevTotal: number | null;
  activeDays: number;
  consistency: number; // 0-1 share of days with activity
  bestDay: DayPoint | null;
  avgPerActiveDay: number;
  longestRun: number;
}

export function computeRangeStats(weeks: ContributionWeek[] | undefined, range: RangeKey): RangeStats {
  const counts = countsByDate(weeks);
  const n = RANGES[range].days;
  const end = toDateStr(new Date());
  const start = addDays(end, -(n - 1));

  const days: DayPoint[] = [];
  for (let i = 0; i < n; i++) {
    const date = addDays(start, i);
    days.push({ date, count: counts.get(date) ?? 0 });
  }

  const total = days.reduce((s, d) => s + d.count, 0);
  const active = days.filter((d) => d.count > 0);
  const bestDay = active.reduce<DayPoint | null>((b, d) => (!b || d.count > b.count ? d : b), null);

  let longestRun = 0;
  let run = 0;
  for (const d of days) {
    run = d.count > 0 ? run + 1 : 0;
    longestRun = Math.max(longestRun, run);
  }

  const prevStart = addDays(start, -n);
  const earliest = counts.size ? Array.from(counts.keys()).sort()[0] : end;
  let prevTotal: number | null = null;
  if (earliest <= prevStart) {
    prevTotal = 0;
    for (let i = 0; i < n; i++) prevTotal += counts.get(addDays(prevStart, i)) ?? 0;
  }

  return {
    days,
    start,
    end,
    total,
    prevTotal,
    activeDays: active.length,
    consistency: active.length / n,
    bestDay,
    avgPerActiveDay: active.length ? total / active.length : 0,
    longestRun,
  };
}

/** Percent change vs the previous period, or null when it can't be computed. */
export function percentDelta(current: number, prev: number | null) {
  if (prev === null) return null;
  if (prev === 0) return current === 0 ? 0 : null;
  return Math.round(((current - prev) / prev) * 100);
}

// ── Heatmap & trend shapes ────────────────────────────────────────────────

/** Sunday-first week columns covering the range; cells outside it are null. */
export function heatmapColumns(stats: RangeStats): (DayPoint | null)[][] {
  const first = parseDateStr(stats.start);
  const gridStart = addDays(stats.start, -first.getDay());
  const byDate = new Map(stats.days.map((d) => [d.date, d]));
  const cols: (DayPoint | null)[][] = [];
  for (let date = gridStart; date <= stats.end; ) {
    const col: (DayPoint | null)[] = [];
    for (let i = 0; i < 7; i++, date = addDays(date, 1)) col.push(byDate.get(date) ?? null);
    cols.push(col);
  }
  return cols;
}

export function heatLevel(count: number, max: number) {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
}

export interface Bucket {
  label: string;
  detail: string;
  count: number;
}

/** Daily bars for a month, weekly bars for longer ranges. */
export function trendBuckets(stats: RangeStats, range: RangeKey): Bucket[] {
  if (range === '30') {
    return stats.days.map((d) => ({
      label: formatDay(d.date, { day: 'numeric' }),
      detail: formatDay(d.date, { weekday: 'short', month: 'short', day: 'numeric' }),
      count: d.count,
    }));
  }
  return heatmapColumns(stats).map((col) => {
    const days = col.filter((d): d is DayPoint => d !== null);
    return {
      label: formatDay(days[0].date),
      detail: `Week of ${formatDay(days[0].date)}`,
      count: days.reduce((s, d) => s + d.count, 0),
    };
  });
}

export function computeMonthLabels(weeks?: ContributionWeek[]) {
  if (!weeks) return [];
  const labels: string[] = [];
  let lastMonth = -1;
  for (const week of weeks) {
    if (!week.contributionDays.length) {
      labels.push('');
      continue;
    }
    const d = parseDateStr(week.contributionDays[0].date);
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

// ── Local commit analytics ────────────────────────────────────────────────

export function commitsInRange(commits: LocalCommit[] | undefined, stats: RangeStats) {
  return (commits ?? []).filter((c) => c.d >= stats.start && c.d <= stats.end);
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function rhythm(commits: LocalCommit[]) {
  const weekday = Array(7).fill(0); // Monday-first
  const hours = Array(24).fill(0);
  for (const c of commits) {
    weekday[(parseDateStr(c.d).getDay() + 6) % 7]++;
    hours[c.h]++;
  }
  const total = commits.length;
  const peakDay = total ? weekday.indexOf(Math.max(...weekday)) : -1;

  // Busiest 3-hour window reads better than a single peak hour.
  let peakStart = -1;
  let peakCount = 0;
  for (let h = 0; h < 24; h++) {
    const c = hours[h] + hours[(h + 1) % 24] + hours[(h + 2) % 24];
    if (c > peakCount) {
      peakCount = c;
      peakStart = h;
    }
  }

  const weekend = weekday[5] + weekday[6];
  const night = hours.reduce((s, c, h) => (h >= 22 || h < 5 ? s + c : s), 0);
  return {
    weekday,
    hours,
    total,
    peakDay,
    peakStart,
    weekendShare: total ? weekend / total : 0,
    nightShare: total ? night / total : 0,
  };
}

export function formatHour(h: number) {
  const hh = ((h % 24) + 24) % 24;
  const suffix = hh < 12 ? 'am' : 'pm';
  return `${hh % 12 === 0 ? 12 : hh % 12}${suffix}`;
}

export function compactNumber(n: number) {
  return Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

// ── Weekly goal ───────────────────────────────────────────────────────────

export interface GoalWeek {
  start: string;
  active: number;
  hit: boolean;
  current: boolean;
}

/** Sunday-first weeks (matching the heatmap), oldest first; the last entry is this week. */
export function weeklyGoal(weeks: ContributionWeek[] | undefined, goal: number, nWeeks = 8) {
  const counts = countsByDate(weeks);
  const today = toDateStr(new Date());
  const thisWeek = addDays(today, -parseDateStr(today).getDay());

  const history: GoalWeek[] = [];
  for (let i = nWeeks - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    let active = 0;
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, d);
      if (date <= today && (counts.get(date) ?? 0) > 0) active++;
    }
    history.push({ start, active, hit: active >= goal, current: i === 0 });
  }

  const thisWeekDays = Array.from({ length: 7 }, (_, d) => {
    const date = addDays(thisWeek, d);
    return { date, count: counts.get(date) ?? 0, future: date > today, today: date === today };
  });

  const current = history[history.length - 1];
  const todayActive = (counts.get(today) ?? 0) > 0;
  // Days still available this week, counting today only if it isn't already active.
  const daysLeft = 6 - parseDateStr(today).getDay() + (todayActive ? 0 : 1);
  const needed = Math.max(0, goal - current.active);

  const completed = history.slice(0, -1);
  let weekStreak = current.hit ? 1 : 0;
  for (let i = completed.length - 1; i >= 0 && completed[i].hit; i--) weekStreak++;

  return {
    history,
    thisWeekDays,
    current,
    needed,
    daysLeft,
    reachable: needed <= daysLeft,
    weekStreak,
    hitRate: completed.length ? completed.filter((w) => w.hit).length / completed.length : 0,
    todayActive,
  };
}

// ── Pull request delivery ─────────────────────────────────────────────────

export interface SearchPR {
  number: number;
  title: string;
  url: string;
  createdAt: string;
  closedAt?: string;
  updatedAt?: string;
  isDraft?: boolean;
  repository?: { name: string; nameWithOwner: string };
  author?: { login: string };
}

export function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const HOUR = 3600000;

/** Hours from open to merge for PRs merged within [start, end] (local dates). */
export function cycleTimes(merged: SearchPR[], start: string, end: string) {
  return merged
    .filter((p) => p.closedAt && toDateStr(new Date(p.closedAt)) >= start && toDateStr(new Date(p.closedAt)) <= end)
    .map((p) => ({ pr: p, hours: (new Date(p.closedAt!).getTime() - new Date(p.createdAt).getTime()) / HOUR }));
}

export function formatDuration(hours: number) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  if (hours < 24 * 60) return `${Math.round(hours / 24)}d`;
  return `${Math.round(hours / 24 / 30)}mo`;
}

export const CYCLE_BUCKETS = [
  { label: '< 1 hour', max: 1 },
  { label: '< 1 day', max: 24 },
  { label: '< 1 week', max: 24 * 7 },
  { label: '1 week +', max: Infinity },
];

// ── Languages ─────────────────────────────────────────────────────────────

const LANGUAGE_BY_KEY: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript', mts: 'TypeScript', cts: 'TypeScript',
  js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  go: 'Go', py: 'Python', rs: 'Rust', java: 'Java', kt: 'Kotlin', swift: 'Swift',
  rb: 'Ruby', php: 'PHP', cs: 'C#', c: 'C', h: 'C', cpp: 'C++', cc: 'C++', hpp: 'C++',
  dart: 'Dart', scala: 'Scala', ex: 'Elixir', exs: 'Elixir', lua: 'Lua', sol: 'Solidity',
  css: 'CSS', scss: 'CSS', sass: 'CSS', less: 'CSS', html: 'HTML', vue: 'Vue', svelte: 'Svelte',
  md: 'Markdown', mdx: 'Markdown', txt: 'Text',
  json: 'Config', yaml: 'Config', yml: 'Config', toml: 'Config', ini: 'Config', env: 'Config', xml: 'Config',
  sh: 'Shell', bash: 'Shell', zsh: 'Shell', sql: 'SQL', proto: 'Protobuf', graphql: 'GraphQL', gql: 'GraphQL',
  dockerfile: 'Docker', makefile: 'Make',
};

export function languageName(key: string) {
  return LANGUAGE_BY_KEY[key] ?? (key === 'other' ? 'Other' : `.${key}`);
}

export function languageMix(commits: LocalCommit[]) {
  const totals = new Map<string, number>();
  for (const c of commits) {
    for (const [key, lines] of Object.entries(c.l ?? {})) {
      const name = languageName(key);
      totals.set(name, (totals.get(name) ?? 0) + lines);
    }
  }
  return Array.from(totals, ([name, lines]) => ({ name, lines })).sort((a, b) => b.lines - a.lines);
}
