export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : decimals))} ${sizes[i]}`;
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat(undefined, { notation: n >= 10000 ? 'compact' : 'standard' }).format(n);
}

/** Go serialises a missing time as year 1; treat that as unknown. */
export function validDate(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) || d.getFullYear() < 1971 ? null : d;
}

export function timeAgo(iso: string): string {
  const d = validDate(iso);
  if (!d) return '—';
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  const units: [number, string][] = [
    [60, 'min'],
    [3600, 'h'],
    [86400, 'd'],
    [86400 * 30, 'mo'],
    [86400 * 365, 'y'],
  ];
  let label = '';
  for (const [secs, unit] of units) {
    if (s >= secs) label = `${Math.floor(s / secs)}${unit === 'min' ? ' min' : unit}`;
  }
  return `${label} ago`;
}

export function formatDate(iso: string): string {
  const d = validDate(iso);
  return d ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

export function daysSince(iso: string): number {
  const d = validDate(iso);
  return d ? (Date.now() - d.getTime()) / 86400000 : Infinity;
}
