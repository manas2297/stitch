import type { ReactNode } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatBytes, formatCount } from './format';

export interface BarItem {
  key: string;
  label: ReactNode;
  bytes: number;
  files: number;
  hint?: string;
  extra?: ReactNode;
}

/** Ranked horizontal bars sized relative to the largest item, labelled with size and share of total. */
export default function BarList({ items, total, empty }: { items: BarItem[]; total: number; empty: string }) {
  if (items.length === 0) return <p className="text-muted-foreground py-4 text-sm">{empty}</p>;
  const max = Math.max(...items.map((i) => i.bytes), 1);

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const share = total > 0 ? Math.round((item.bytes / total) * 100) : 0;
        const row = (
          <li key={item.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">{item.label}</span>
                {item.extra}
              </span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                <span className="text-foreground font-semibold">{formatBytes(item.bytes)}</span> · {share}% ·{' '}
                {formatCount(item.files)} files
              </span>
            </div>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div className="bg-primary/80 h-full rounded-full" style={{ width: `${(item.bytes / max) * 100}%` }} />
            </div>
          </li>
        );
        if (!item.hint) return row;
        return (
          <Tooltip key={item.key}>
            <TooltipTrigger asChild>{row}</TooltipTrigger>
            <TooltipContent side="top" align="start">
              {item.hint}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </ul>
  );
}
