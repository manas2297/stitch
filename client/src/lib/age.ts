export type AgeTone = 'fresh' | 'recent' | 'aging' | 'stale';

export function ageOf(dateStr: string): { tone: AgeTone; label: string } {
  const days = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  if (days < 2) return { tone: 'fresh', label: 'Today' };
  if (days < 7) return { tone: 'recent', label: `${Math.floor(days)}d ago` };
  if (days < 30) return { tone: 'aging', label: `${Math.floor(days)}d ago` };
  return { tone: 'stale', label: `${Math.floor(days / 30)}mo ago` };
}
