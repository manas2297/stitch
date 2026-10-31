import { useEffect, useState } from 'react';
import { CalendarPlus, Download, ListPlus, Trash2, Video } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  extractActionItems,
  formatRange,
  fromInputDateTime,
  googleCalendarUrl,
  isUrl,
  openExternal,
  toInputDateTime,
  type Meeting,
  type Task,
} from '@/lib/planner';
import { saveDownload } from '@/lib/desktop';
import type { Planner } from '@/lib/usePlanner';
import { confirmDialog } from '../../helper/confirm';
import { useToast } from '../Toast';

const DURATIONS = [15, 30, 45, 60, 90, 120];

/** Draft for a new meeting at a given start, or an existing meeting to edit. */
export type MeetingTarget = { meeting: Meeting } | { start: string };

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">{label}</span>
      {children}
    </label>
  );
}

export default function MeetingDialog({
  target,
  planner,
  projectLabel,
  tasks,
  onClose,
}: {
  target: MeetingTarget | null;
  planner: Planner;
  projectLabel: string;
  tasks: Task[];
  onClose: () => void;
}) {
  const toast = useToast();
  const existing = target && 'meeting' in target ? target.meeting : null;
  const [form, setForm] = useState({ title: '', start: '', durationMin: 30, location: '', attendees: '', agenda: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    const m = 'meeting' in target ? target.meeting : null;
    setForm({
      title: m?.title ?? '',
      start: toInputDateTime(m?.start ?? (target as { start: string }).start),
      durationMin: m?.durationMin ?? 30,
      location: m?.location ?? '',
      attendees: m?.attendees.join(', ') ?? '',
      agenda: m?.agenda ?? '',
      notes: m?.notes ?? '',
    });
  }, [target]);

  if (!target) return null;

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const payload = () => ({
    title: form.title.trim(),
    start: fromInputDateTime(form.start),
    durationMin: form.durationMin,
    location: form.location.trim(),
    attendees: form.attendees.split(/[,\n]/).map((a) => a.trim()).filter(Boolean),
    agenda: form.agenda,
    notes: form.notes,
  });

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form.title.trim() || !form.start) return;
    setSaving(true);
    try {
      if (existing) await planner.updateMeeting(existing.id, payload());
      else await planner.createMeeting(payload());
      toast(existing ? 'Meeting updated' : 'Meeting scheduled', 'success');
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Action items already turned into tasks for this meeting are not offered again.
  const actionItems = extractActionItems(form.notes);
  const existingTitles = new Set(tasks.filter((t) => existing && t.meetingId === existing.id).map((t) => t.title.toLowerCase()));
  const newActionItems = actionItems.filter((a) => !existingTitles.has(a.toLowerCase()));
  const draft = { ...existing, ...payload() } as Meeting;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl [&>*]:min-w-0">
        <form onSubmit={save} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{existing ? 'Meeting' : 'Schedule a meeting'}</DialogTitle>
            <DialogDescription>
              For <strong className="text-foreground">{projectLabel}</strong>
              {form.start && <> · {new Date(fromInputDateTime(form.start)).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}, {formatRange(fromInputDateTime(form.start), form.durationMin)}</>}
            </DialogDescription>
          </DialogHeader>

          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Sprint planning, design review…" aria-label="Meeting title" autoFocus={!existing} className="text-base font-semibold" />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <Field label="Starts">
              <Input type="datetime-local" value={form.start} onChange={(e) => set('start', e.target.value)} />
            </Field>
            <Field label="Duration">
              <Select value={String(form.durationMin)} onValueChange={(v) => set('durationMin', Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d < 60 ? `${d} min` : `${d / 60} h`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Link or room">
              <Input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="https://meet.google.com/…" />
            </Field>
            <Field label="Attendees">
              <Input value={form.attendees} onChange={(e) => set('attendees', e.target.value)} placeholder="a@team.dev, b@team.dev" />
            </Field>
          </div>

          <Field label="Agenda">
            <Textarea value={form.agenda} onChange={(e) => set('agenda', e.target.value)} placeholder={'1. Demo\n2. Blockers\n3. Next steps'} className="min-h-20 text-sm" />
          </Field>

          {existing && (
            <Field label="Notes">
              <Textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder={'Decisions and notes…\n- [ ] Action items become tasks\nTODO: so does this'}
                className="min-h-28 font-mono text-sm"
              />
            </Field>
          )}

          {existing && newActionItems.length > 0 && (
            <div className="bg-primary/5 border-primary/20 flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span>
                <strong>{newActionItems.length}</strong> action item{newActionItems.length === 1 ? '' : 's'} in the notes
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await planner.updateMeeting(existing.id, { notes: form.notes });
                    await planner.createTasks(newActionItems.map((title) => ({ title, status: 'todo', meetingId: existing.id, tags: ['meeting'] })));
                    toast(`Created ${newActionItems.length} task${newActionItems.length === 1 ? '' : 's'}`, 'success');
                  } catch (err) {
                    toast(err.message, 'error');
                  }
                }}
              >
                <ListPlus /> Create tasks
              </Button>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {isUrl(form.location) && (
                <Button type="button" size="sm" variant="outline" onClick={() => openExternal(form.location.trim())}>
                  <Video /> Join
                </Button>
              )}
              {form.title.trim() && form.start && (
                <Button type="button" size="sm" variant="outline" onClick={() => openExternal(googleCalendarUrl(draft, projectLabel))}>
                  <CalendarPlus /> Google Calendar
                </Button>
              )}
              {existing && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    saveDownload(`/api/focus/meetings/${existing.id}/ics`, 'meeting.ics').catch((err) => toast(err.message, 'error'))
                  }
                >
                  <Download /> .ics
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {existing && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={async () => {
                    if (!(await confirmDialog('Delete meeting', `Delete "${existing.title}"?`))) return;
                    try {
                      await planner.deleteMeeting(existing.id);
                      onClose();
                    } catch (err) {
                      toast(err.message, 'error');
                    }
                  }}
                >
                  <Trash2 /> Delete
                </Button>
              )}
              <Button type="submit" size="sm" disabled={!form.title.trim() || !form.start || saving}>
                {existing ? 'Save' : 'Schedule'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
