import { useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatBytes, formatCount } from './format';
import type { DayStat } from './types';

type Metric = 'sessionsStarted' | 'filesCreated' | 'bytesCreated';

const METRICS: { id: Metric; label: string; unit: string; format: (n: number) => string }[] = [
  { id: 'sessionsStarted', label: 'Sessions', unit: 'sessions started', format: formatCount },
  { id: 'filesCreated', label: 'Files', unit: 'files created', format: formatCount },
  { id: 'bytesCreated', label: 'Data', unit: 'written', format: (n) => formatBytes(n) },
];

function shortDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** 30-day daily bar chart with a metric switch and per-bar hover tooltip. */
export default function ActivityChart({ days, showSessions }: { days: DayStat[]; showSessions: boolean }) {
  const metrics = showSessions ? METRICS : METRICS.slice(1);
  const [metricId, setMetricId] = useState<Metric>(metrics[0].id);
  const [hover, setHover] = useState<number | null>(null);
  const metric = metrics.find((m) => m.id === metricId) ?? metrics[0];

  const values = days.map((d) => d[metric.id]);
  const max = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0);
  const activeDays = values.filter((v) => v > 0).length;
  const peak = values.indexOf(Math.max(...values));
  const hovered = hover !== null ? days[hover] : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-bold tracking-tight">{metric.format(total)}</div>
          <div className="text-muted-foreground text-xs">
            {metric.unit} in 30 days · {activeDays} active days
            {total > 0 && ` · peak ${metric.format(values[peak])} on ${shortDate(days[peak].date)}`}
          </div>
        </div>
        <Tabs value={metric.id} onValueChange={(v) => setMetricId(v as Metric)}>
          <TabsList>
            {metrics.map((m) => (
              <TabsTrigger key={m.id} value={m.id} className="px-3 text-xs">
                {m.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="relative" role="img" aria-label={`Daily ${metric.unit}, last 30 days`}>
        {hovered && (
          <div
            className="bg-popover text-popover-foreground pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-md border px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md"
            style={{ left: `${((hover! + 0.5) / days.length) * 100}%` }}
          >
            <div className="font-semibold">{shortDate(hovered.date)}</div>
            <div className="text-muted-foreground">
              {showSessions && <div>{formatCount(hovered.sessionsStarted)} sessions</div>}
              <div>{formatCount(hovered.filesCreated)} files</div>
              <div>{formatBytes(hovered.bytesCreated)}</div>
            </div>
          </div>
        )}
        <div className="flex h-36 items-end border-b" onMouseLeave={() => setHover(null)}>
          {days.map((d, i) => {
            const h = (values[i] / max) * 100;
            return (
              <div
                key={d.date}
                className="flex h-full flex-1 cursor-default items-end px-px"
                onMouseEnter={() => setHover(i)}
              >
                <div
                  className={cn(
                    'w-full rounded-t-[4px] transition-colors',
                    hover === i ? 'bg-primary' : 'bg-primary/70',
                    values[i] > 0 && 'min-h-0.5',
                  )}
                  style={{ height: `${h}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="text-muted-foreground mt-1.5 flex justify-between text-[0.68rem]">
          <span>{shortDate(days[0].date)}</span>
          <span>{shortDate(days[Math.floor(days.length / 2)].date)}</span>
          <span>Today</span>
        </div>
      </div>

      <table className="sr-only">
        <caption>Daily activity, last 30 days</caption>
        <thead>
          <tr>
            <th>Date</th>
            {showSessions && <th>Sessions</th>}
            <th>Files</th>
            <th>Bytes</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              {showSessions && <td>{d.sessionsStarted}</td>}
              <td>{d.filesCreated}</td>
              <td>{d.bytesCreated}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
