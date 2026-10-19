import { useEffect, useState } from 'react';
import { CalendarX, CircleDot, ExternalLink, Loader2, Plus, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { ageOf } from '@/lib/age';
import {
  checklistProgress,
  fromInputDateTime,
  openExternal,
  PRIORITIES,
  STATUSES,
  toInputDateTime,
  type ChecklistItem,
  type Meeting,
  type Task,
  type TaskPatch,
} from '@/lib/planner';
import type { Planner } from '@/lib/usePlanner';
import { confirmDialog } from '../../helper/confirm';
import { useToast } from '../Toast';
import { StatusDot } from './taskBits';

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">{label}</span>
      {children}
    </label>
  );
}

const newItemId = () => Math.random().toString(36).slice(2, 10);

export default function TaskDrawer({
  task,
  planner,
  meetings,
  hasRemote,
  onClose,
  onOpenMeeting,
}: {
  task: Task | null;
  planner: Planner;
  meetings: Meeting[];
  hasRemote: boolean;
  onClose: () => void;
  onOpenMeeting: (m: Meeting) => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [newItem, setNewItem] = useState('');
  const [creatingIssue, setCreatingIssue] = useState(false);

  // Text fields are edited locally and saved on blur; everything else saves immediately.
  useEffect(() => {
    setTitle(task?.title ?? '');
    setDescription(task?.description ?? '');
    setTags(task?.tags.join(', ') ?? '');
    setNewItem('');
  }, [task?.id]);

  const save = async (patch: TaskPatch) => {
    if (!task) return;
    try {
      await planner.updateTask(task.id, patch);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (!task) return <Sheet open={false} onOpenChange={onClose} />;

  const progress = checklistProgress(task);
  const meeting = task.meetingId ? meetings.find((m) => m.id === task.meetingId) : undefined;
  const setChecklist = (checklist: ChecklistItem[]) => save({ checklist });

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b p-5 pb-4">
          <SheetDescription className="flex items-center gap-2 text-xs">
            <StatusDot status={task.status} /> Created {ageOf(task.createdAt).label.toLowerCase()}
            {task.completedAt && <> · completed {ageOf(task.completedAt).label.toLowerCase()}</>}
          </SheetDescription>
          <SheetTitle className="sr-only">{task.title}</SheetTitle>
          <Textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== task.title && save({ title })}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), (e.target as HTMLTextAreaElement).blur())}
            rows={1}
            className="field-sizing-content min-h-0 resize-none border-0 px-0 text-xl font-bold shadow-none focus-visible:ring-0 dark:bg-transparent"
            aria-label="Task title"
          />
        </SheetHeader>

        <div className="flex flex-col gap-5 p-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select value={task.status} onValueChange={(v) => save({ status: v as Task['status'] })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <StatusDot status={s.id} /> {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={task.priority} onValueChange={(v) => save({ priority: v as Task['priority'] })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Due date">
              <Input type="date" value={task.dueDate ?? ''} onChange={(e) => save({ dueDate: e.target.value })} />
            </Field>
            <Field label="Tags">
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                onBlur={() => save({ tags: tags.split(',').map((t) => t.trim()).filter(Boolean) })}
                placeholder="api, frontend"
              />
            </Field>
          </div>

          <div className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Time block</span>
              {task.scheduledAt && (
                <Button size="xs" variant="ghost" onClick={() => save({ scheduledAt: '' })}>
                  <CalendarX /> Unschedule
                </Button>
              )}
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
              <Input
                type="datetime-local"
                value={toInputDateTime(task.scheduledAt)}
                onChange={(e) => save({ scheduledAt: fromInputDateTime(e.target.value) })}
                aria-label="Scheduled start"
              />
              <Select value={String(task.durationMin || 60)} onValueChange={(v) => save({ durationMin: Number(v) })}>
                <SelectTrigger className="w-full" aria-label="Duration">
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
            </div>
            <p className="text-muted-foreground text-xs">Blocks time on the calendar. You can also drag the task onto the week view.</p>
          </div>

          <Field label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== task.description && save({ description })}
              placeholder="Context, acceptance criteria, links…"
              className="min-h-28 font-mono text-sm"
            />
          </Field>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Checklist</span>
              {progress.total > 0 && (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {progress.done}/{progress.total}
                </span>
              )}
            </div>
            {progress.total > 0 && <Progress value={(progress.done / progress.total) * 100} className="h-1.5" />}
            <ul className="flex flex-col">
              {task.checklist.map((item) => (
                <li key={item.id} className="group hover:bg-muted/50 -mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5">
                  <Checkbox
                    checked={item.done}
                    onCheckedChange={(v) => setChecklist(task.checklist.map((c) => (c.id === item.id ? { ...c, done: v === true } : c)))}
                    aria-label={item.text}
                  />
                  <span className={item.done ? 'text-muted-foreground flex-1 text-sm line-through' : 'flex-1 text-sm'}>{item.text}</span>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label={`Remove ${item.text}`}
                    onClick={() => setChecklist(task.checklist.filter((c) => c.id !== item.id))}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newItem.trim()) return;
                setChecklist([...task.checklist, { id: newItemId(), text: newItem.trim(), done: false }]);
                setNewItem('');
              }}
            >
              <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add a checklist item…" className="h-8 text-sm" />
              <Button type="submit" size="sm" variant="outline" disabled={!newItem.trim()}>
                <Plus /> Add
              </Button>
            </form>
          </div>

          {meeting && (
            <button type="button" onClick={() => onOpenMeeting(meeting)} className="text-muted-foreground hover:text-foreground text-left text-xs">
              From meeting: <span className="text-foreground font-medium underline-offset-2 hover:underline">{meeting.title}</span>
            </button>
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t p-4">
          {task.githubIssueUrl ? (
            <Button variant="outline" size="sm" asChild>
              <a href={task.githubIssueUrl} target="_blank" rel="noreferrer">
                <CircleDot /> Open GitHub issue <ExternalLink />
              </a>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={!hasRemote || creatingIssue}
              title={hasRemote ? undefined : 'This project has no GitHub remote'}
              onClick={async () => {
                setCreatingIssue(true);
                try {
                  const t = await planner.createIssue(task.id);
                  toast('GitHub issue created', 'success');
                  if (t.githubIssueUrl) openExternal(t.githubIssueUrl);
                } catch (err) {
                  toast(err.message, 'error');
                } finally {
                  setCreatingIssue(false);
                }
              }}
            >
              {creatingIssue ? <Loader2 className="animate-spin" /> : <CircleDot />} Create GitHub issue
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={async () => {
              if (!(await confirmDialog('Delete task', `Delete "${task.title}"? This can't be undone.`))) return;
              try {
                await planner.deleteTask(task.id);
                onClose();
              } catch (err) {
                toast(err.message, 'error');
              }
            }}
          >
            <Trash2 /> Delete
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
