export interface ContributionDay {
  date: string;
  contributionCount: number;
  color?: string;
}

export interface ContributionWeek {
  contributionDays: ContributionDay[];
}

export function computeStreaks(weeks?: ContributionWeek[]) {
  if (!weeks) return { current: 0, longest: 0 };
  const allDays: ContributionDay[] = [];
  for (const week of weeks) for (const day of week.contributionDays) allDays.push(day);
  allDays.sort((a, b) => a.date.localeCompare(b.date));

  let longest = 0;
  let temp = 0;
  for (const day of allDays) {
    if (day.contributionCount > 0) {
      temp++;
      longest = Math.max(longest, temp);
    } else temp = 0;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const pastDays = allDays.filter((d) => d.date <= todayStr).reverse();
  let current = 0;
  let i = 0;
  if (pastDays.length > 0 && pastDays[0].date === todayStr && pastDays[0].contributionCount === 0) i = 1;
  for (; i < pastDays.length; i++) {
    if (pastDays[i].contributionCount > 0) current++;
    else break;
  }
  return { current, longest };
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
