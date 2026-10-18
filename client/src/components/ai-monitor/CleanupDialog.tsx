import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, ShieldCheck, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiFetch } from '../../store/useAppStore';
import { formatBytes, formatCount } from './format';
import type { CleanupResult, CleanupTarget } from './types';

const SESSION_ACTIONS = new Set(['stale-sessions', 'tiny-sessions', 'sessions']);

export async function runCleanup(provider: string, target: CleanupTarget, dryRun: boolean): Promise<CleanupResult> {
  const res = await apiFetch(`/api/provider/${provider}/cleanup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: target.action,
      days: target.days,
      category: target.category,
      ids: target.ids,
      dryRun,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Cleanup failed');
  return json;
}

/** Previews a cleanup with a dry run against a fresh scan, then deletes only on explicit confirmation. */
export default function CleanupDialog({
  provider,
  target,
  onClose,
  onDone,
}: {
  provider: string;
  target: CleanupTarget | null;
  onClose: () => void;
  onDone: (result: CleanupResult) => void;
}) {
  const [preview, setPreview] = useState<CleanupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    setPreview(null);
    setError(null);
    runCleanup(provider, target, true)
      .then((p) => !cancelled && setPreview(p))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [provider, target]);

  const confirm = async () => {
    if (!target) return;
    setRunning(true);
    try {
      onDone(await runCleanup(provider, target, false));
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const isSessions = target && SESSION_ACTIONS.has(target.action);
  const nothing = preview && preview.files === 0;

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && !running && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{target?.label}</DialogTitle>
          <DialogDescription>
            Preview from a fresh scan of <span className="font-mono">~/.{provider}</span>. Nothing is deleted until you
            confirm.
          </DialogDescription>
        </DialogHeader>

        {!preview && !error && (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Loader2 className="size-4 animate-spin" /> Calculating…
          </div>
        )}
        {error && (
          <div role="alert" className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm">
            {error}
          </div>
        )}

        {preview && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Frees', formatBytes(preview.bytes)],
                ['Files', formatCount(preview.files)],
                [isSessions ? 'Sessions' : 'Skipped', formatCount(isSessions ? preview.sessions : preview.skippedRecent)],
              ].map(([label, value]) => (
                <div key={label} className="bg-muted/60 rounded-lg px-2 py-3">
                  <div className="text-lg font-bold tabular-nums">{value}</div>
                  <div className="text-muted-foreground text-[0.7rem] font-medium tracking-wider uppercase">{label}</div>
                </div>
              ))}
            </div>

            {preview.sample.length > 0 && (
              <div>
                <div className="text-muted-foreground mb-1.5 text-xs font-medium">Largest files affected</div>
                <ul className="bg-muted/40 max-h-40 overflow-auto rounded-md border p-2 font-mono text-[0.7rem] leading-relaxed">
                  {preview.sample.map((p) => (
                    <li key={p} className="truncate" title={p}>
                      {p}
                    </li>
                  ))}
                  {preview.files > preview.sample.length && (
                    <li className="text-muted-foreground">…and {formatCount(preview.files - preview.sample.length)} more</li>
                  )}
                </ul>
              </div>
            )}

            {isSessions && !nothing && (
              <p className="text-warning flex gap-2 text-xs leading-relaxed">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                Deleted sessions can no longer be resumed, and their history and file snapshots are gone for good.
              </p>
            )}
            <p className="text-muted-foreground flex gap-2 text-xs leading-relaxed">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              Settings, credentials, memory and extensions are never touched. Anything active in the last 15 minutes is
              skipped{preview.skippedRecent > 0 ? ` (${preview.skippedRecent} skipped now)` : ''}.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={running}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={!preview || nothing || running}>
            {running ? <Loader2 className="animate-spin" /> : <Trash2 />}
            {nothing ? 'Nothing to delete' : `Delete ${preview ? formatBytes(preview.bytes) : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
