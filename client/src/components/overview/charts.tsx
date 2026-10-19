import { useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/*
 * Chart colours are CSS custom properties defined per theme in styles/tailwind.css, so these
 * exports work anywhere a CSS colour does (inline styles, SVG fill/stroke) and switch with the theme.
 * Never hardcode hex for chart marks; never put text-white on ACTIVITY (use ACTIVITY_FG).
 */

/** Single-hue sequential ramp for activity intensity (GitHub's greens, step 0 = empty cell). */
export const HEAT = ['var(--heat-0)', 'var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)', 'var(--heat-4)'];
export const ACTIVITY = 'var(--activity)';
/** Text/icon colour on an ACTIVITY-filled mark (white in light, dark green in dark). */
export const ACTIVITY_FG = 'var(--activity-foreground)';

/** Categorical slots in fixed order — validated for adjacent CVD separation in both themes. */
export const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];
export const NEUTRAL = 'var(--series-neutral)';

export function ChartTooltip({ children, style }: { children: ReactNode; style: React.CSSProperties }) {
  return (
    <div
      role="tooltip"
      className="bg-foreground text-background pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-md px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md"
      style={style}
    >
      {children}
    </div>
  );
}

export interface ColumnDatum {
  label: string;
  detail: string;
  count: number;
}

/**
 * Vertical bars with a per-bar hover tooltip. Each column's hit target spans
 * the full chart height so thin or zero bars are still easy to hover.
 */
export function ColumnChart({
  data,
  color,
  noun,
  height = 112,
  labelEvery = 1,
  ariaLabel,
  highlight,
}: {
  data: ColumnDatum[];
  color: string;
  noun: string;
  height?: number;
  labelEvery?: number;
  ariaLabel: string;
  highlight?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const n = data.length;

  return (
    <div role="img" aria-label={ariaLabel} className="relative w-full">
      <div className="relative" style={{ height }}>
        {/* Recessive gridline at the max value */}
        <div className="border-border absolute inset-x-0 top-0 border-t border-dashed" />
        <span className="text-muted-foreground bg-card absolute -top-2 right-0 pl-1 text-[0.6rem] tabular-nums">{max}</span>
        <div className="absolute inset-0 flex items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
          {data.map((d, i) => (
            <div key={i} className="flex h-full min-w-0 flex-1 items-end" onMouseEnter={() => setHover(i)}>
              <div
                className={cn('w-full rounded-t-[4px] transition-opacity', hover !== null && hover !== i && 'opacity-50')}
                style={{
                  height: d.count > 0 ? `max(3px, ${(d.count / max) * 100}%)` : 1,
                  backgroundColor: d.count > 0 ? color : 'var(--border)',
                  outline: highlight === i ? `2px solid ${color}` : undefined,
                  outlineOffset: 2,
                }}
              />
            </div>
          ))}
        </div>
        {hover !== null && (
          <ChartTooltip style={{ left: `${((hover + 0.5) / n) * 100}%`, top: -6 }}>
            <span className="font-semibold tabular-nums">{data[hover].count}</span> {noun} · {data[hover].detail}
          </ChartTooltip>
        )}
      </div>
      <div className="border-border mt-1 flex gap-[2px] border-t pt-1">
        {data.map((d, i) => (
          <div key={i} className="text-muted-foreground min-w-0 flex-1 overflow-visible text-center text-[0.6rem] whitespace-nowrap">
            {i % labelEvery === 0 ? d.label : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Horizontal share bar row used by ranked lists. */
export function ShareBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
      <div className="h-full rounded-full" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, backgroundColor: color }} />
    </div>
  );
}

export function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="bg-muted/60 inline-flex gap-0.5 rounded-lg border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors outline-none focus-visible:ring-[3px] [&>svg]:size-3.5',
            value === o.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Tiny weekly bars for table rows. */
export function Sparkline({ values, width = 84 }: { values: number[]; width?: number }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-5 items-end gap-[2px]" style={{ width }} role="img" aria-label={`Weekly commits, last ${values.length} weeks: ${values.join(', ')}`}>
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[2px]"
          style={{ height: v ? `max(3px, ${(v / max) * 100}%)` : 1, backgroundColor: v ? ACTIVITY : 'var(--border)' }}
        />
      ))}
    </div>
  );
}
