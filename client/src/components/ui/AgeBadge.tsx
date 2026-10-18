import { ageOf, type AgeTone } from '@/lib/age';
import { cn } from '@/lib/utils';

const tones: Record<AgeTone, string> = {
  fresh: 'bg-success/12 text-success',
  recent: 'bg-primary/10 text-primary',
  aging: 'bg-warning/12 text-warning',
  stale: 'bg-destructive/10 text-destructive',
};

export function AgeBadge({ date, className }: { date: string; className?: string }) {
  const { tone, label } = ageOf(date);
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[0.7rem] font-semibold whitespace-nowrap', tones[tone], className)}>
      {label}
    </span>
  );
}
