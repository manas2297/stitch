import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  FilePlus2,
  FolderSearch,
  HardDrive,
  Info,
  MessagesSquare,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { apiFetch } from '../store/useAppStore';
import ActivityChart from './ai-monitor/ActivityChart';
import BarList from './ai-monitor/BarList';
import CleanupDialog from './ai-monitor/CleanupDialog';
import { formatBytes, formatCount, timeAgo } from './ai-monitor/format';
import SessionsTable from './ai-monitor/SessionsTable';
import type { ActionInfo, ActionRef, CleanupResult, CleanupTarget, Insight, ProviderInfo, Report } from './ai-monitor/types';
import LoadingState, { ErrorMessage } from './layout/LoadingState';
import PageHeader from './layout/PageHeader';
import { useToast } from './Toast';

const STORAGE_KEY = 'stitch.aiMonitor.provider';

const LEVELS: Record<Insight['level'], { icon: typeof Info; className: string; label: string }> = {
  critical: { icon: AlertOctagon, className: 'text-destructive', label: 'Critical' },
  warn: { icon: AlertTriangle, className: 'text-warning', label: 'Warning' },
  info: { icon: Info, className: 'text-primary', label: 'Note' },
  good: { icon: CheckCircle2, className: 'text-success', label: 'OK' },
};

function readSaved(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function findAction(report: Report, ref: ActionRef): ActionInfo | undefined {
  return report.actions.find((a) => a.action === ref.action && (a.category ?? '') === (ref.category ?? ''));
}

export default function AIMonitor() {
  const toast = useToast();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<CleanupTarget | null>(null);
  const cleanupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch('/api/providers')
      .then((r) => r.json())
      .then((list: ProviderInfo[]) => {
        setProviders(list);
        const saved = readSaved();
        const pick = list.find((p) => p.id === saved) ?? list.find((p) => p.exists) ?? list[0];
        setProvider(pick?.id ?? null);
      })
      .catch((e) => setError(e.message));
  }, []);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/provider/${id}/analysis`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed to analyse ${id}`);
      setReport(json);
    } catch (e) {
      setError(e.message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!provider) return;
    try {
      localStorage.setItem(STORAGE_KEY, provider);
    } catch {
      /* per-viewer convenience only */
    }
    load(provider);
  }, [provider, load]);

  const openAction = (ref: ActionRef) => {
    const info = report && findAction(report, ref);
    setTarget({ ...ref, label: info?.label ?? 'Clean up' });
  };

  const onCleaned = (result: CleanupResult) => {
    setTarget(null);
    const failed = result.failed ? `, ${result.failed} could not be removed` : '';
    toast(`Freed ${formatBytes(result.freedBytes)} (${formatCount(result.deleted)} files${failed}).`, result.failed ? 'warning' : 'success');
    if (provider) load(provider);
  };

  const sessions = report?.sessions;

  return (
    <section id="ai-monitor-section">
      <PageHeader
        title="AI Monitor"
        description="How you use your AI tools, what they leave on disk, and what can be cleaned up."
        actions={
          <>
            {report && (
              <span className="text-muted-foreground text-xs">
                Scanned {timeAgo(report.scannedAt)} · {report.scanMs} ms
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => provider && load(provider)} disabled={loading || !provider}>
              <RefreshCw className={cn(loading && 'animate-spin')} /> Rescan
            </Button>
          </>
        }
      />

      {providers.length > 0 && provider && (
        <Tabs value={provider} onValueChange={setProvider} className="mb-6">
          <TabsList className="h-auto flex-wrap">
            {providers.map((p) => (
              <TabsTrigger key={p.id} value={p.id} className={cn('px-3', !p.exists && 'opacity-60')}>
                {p.label}
                {!p.exists && <span className="text-muted-foreground text-[0.65rem]">not found</span>}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {error && <ErrorMessage>{error}</ErrorMessage>}
      {loading && !report && <LoadingState label="Scanning…" />}

      {report && !report.exists && (
        <Card>
          <EmptyState
            icon={FolderSearch}
            title={`No ${report.label} data found`}
            description={`${report.root} doesn't exist on this machine. Pick another tool above.`}
          />
        </Card>
      )}

      {report && report.exists && sessions && (
        <div className={cn('flex flex-col gap-6 transition-opacity', loading && 'opacity-60')}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={HardDrive}
              variant="blue"
              value={formatBytes(report.total.bytes)}
              label="Storage used"
              sublabel={`${formatCount(report.total.files)} files in ~/.${report.provider}`}
            />
            {sessions.supported ? (
              <StatCard
                icon={MessagesSquare}
                variant="purple"
                value={formatCount(sessions.total)}
                label="Sessions"
                sublabel={`${sessions.active7d} active · ${sessions.started7d} new this week`}
              />
            ) : (
              <StatCard
                icon={MessagesSquare}
                variant="purple"
                value={formatBytes(report.media.bytes)}
                label="Media"
                sublabel={`${formatCount(report.media.files)} screenshots & recordings`}
              />
            )}
            <StatCard
              icon={FilePlus2}
              variant="orange"
              value={formatBytes(report.created7d.bytes)}
              label="Added this week"
              sublabel={`${formatCount(report.created7d.files)} new files · ${formatBytes(report.created30d.bytes)} in 30d`}
            />
            <StatCard
              icon={Sparkles}
              variant="green"
              value={formatBytes(report.reclaimable.bytes)}
              label="Reclaimable"
              sublabel="Review cleanup actions →"
              onClick={() => cleanupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Activity</CardTitle>
                <CardDescription>What your AI tools created each day, last 30 days</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <ActivityChart key={report.provider} days={report.activity} showSessions={sessions.supported} />
                {sessions.supported && sessions.total > 0 && (
                  <dl className="grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4">
                    {[
                      ['Per active day', sessions.perActiveDay.toFixed(1), 'sessions started'],
                      ['Median session', formatBytes(sessions.medianBytes), 'on disk'],
                      ['Largest session', formatBytes(sessions.largestBytes), 'on disk'],
                      ['Stale 30d+', formatCount(sessions.staleSessions), formatBytes(sessions.stale.bytes)],
                    ].map(([label, value, hint]) => (
                      <div key={label}>
                        <dt className="text-muted-foreground text-[0.7rem] font-medium tracking-wider uppercase">{label}</dt>
                        <dd className="text-lg font-bold tabular-nums">{value}</dd>
                        <dd className="text-muted-foreground text-xs">{hint}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Insights</CardTitle>
                <CardDescription>Usage patterns and storage concerns</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col divide-y">
                  {report.insights.map((ins) => {
                    const lvl = LEVELS[ins.level];
                    const Icon = lvl.icon;
                    return (
                      <li key={ins.title} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                        <Icon className={cn('mt-0.5 size-4 shrink-0', lvl.className)} aria-label={lvl.label} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">{ins.title}</div>
                          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{ins.detail}</p>
                          {ins.action && (
                            <Button size="xs" variant="outline" className="mt-2" onClick={() => openAction(ins.action!)}>
                              <Trash2 /> Review cleanup
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Where the space goes</CardTitle>
                <CardDescription>Storage by area</CardDescription>
              </CardHeader>
              <CardContent>
                <BarList
                  total={report.total.bytes}
                  empty="No files found."
                  items={report.categories.map((c) => ({
                    key: c.id,
                    label: c.label,
                    bytes: c.bytes,
                    files: c.files,
                    hint: c.description,
                    extra: c.cleanable ? (
                      <Badge variant="green" className="px-1.5 py-0 text-[0.6rem]">
                        cache
                      </Badge>
                    ) : null,
                  }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>File types</CardTitle>
                <CardDescription>Largest file types by size</CardDescription>
              </CardHeader>
              <CardContent>
                <BarList
                  total={report.total.bytes}
                  empty="No files found."
                  items={report.fileTypes.map((t) => ({
                    key: t.extension,
                    label: <span className="font-mono text-xs">{t.extension === 'other' || t.extension === '(none)' ? t.extension : `.${t.extension}`}</span>,
                    bytes: t.bytes,
                    files: t.files,
                  }))}
                />
              </CardContent>
            </Card>
          </div>

          {sessions.supported && report.groups.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>By project</CardTitle>
                <CardDescription>Which projects you use AI on most, by sessions and storage</CardDescription>
              </CardHeader>
              <CardContent>
                <BarList
                  total={report.total.bytes}
                  empty="No projects."
                  items={report.groups.slice(0, 10).map((g) => ({
                    key: g.label,
                    label: <span title={g.label}>{g.label || '—'}</span>,
                    bytes: g.bytes,
                    files: g.sessions,
                    extra: (
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {g.sessions} sessions · {timeAgo(g.lastActive)}
                      </span>
                    ),
                  }))}
                />
              </CardContent>
            </Card>
          )}

          {sessions.supported && (
            <Card>
              <CardHeader>
                <CardTitle>Sessions</CardTitle>
                <CardDescription>Every chat on disk. Select some to delete them with their side data.</CardDescription>
              </CardHeader>
              <CardContent>
                <SessionsTable
                  key={report.scannedAt}
                  sessions={sessions.list}
                  truncated={sessions.truncated}
                  onDelete={(ids, label) => setTarget({ action: 'sessions', ids, label })}
                />
              </CardContent>
            </Card>
          )}

          <Card ref={cleanupRef} className="scroll-mt-4">
            <CardHeader>
              <CardTitle>Cleanup actions</CardTitle>
              <CardDescription>Each action previews exactly what it removes before anything is deleted</CardDescription>
              <CardAction className="text-muted-foreground text-xs">
                up to <strong className="text-foreground">{formatBytes(report.reclaimable.bytes)}</strong>
              </CardAction>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {report.actions.map((a) => {
                const empty = a.estimate.files === 0;
                return (
                  <div
                    key={`${a.action}:${a.category ?? ''}`}
                    className={cn('flex flex-col justify-between gap-3 rounded-lg border p-4', empty && 'opacity-60')}
                  >
                    <div>
                      <div className="text-sm font-semibold">{a.label}</div>
                      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{a.description}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs tabular-nums">
                        {empty ? (
                          <span className="text-muted-foreground">Nothing to clean</span>
                        ) : (
                          <>
                            <strong>{formatBytes(a.estimate.bytes)}</strong>
                            <span className="text-muted-foreground">
                              {' '}
                              · {a.sessions > 0 ? `${formatCount(a.sessions)} sessions` : `${formatCount(a.estimate.files)} files`}
                            </span>
                          </>
                        )}
                      </span>
                      <Button size="sm" variant="outline" disabled={empty} onClick={() => openAction(a)}>
                        Review
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {provider && (
        <CleanupDialog provider={provider} target={target} onClose={() => setTarget(null)} onDone={onCleaned} />
      )}
    </section>
  );
}
