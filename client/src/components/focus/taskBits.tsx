import { CalendarClock, CalendarDays, CheckSquare, CircleDot, MessageSquare } from 'lucide-react';

import { checklistProgress, formatTime, isOverdue, PRIORITY_BY_ID, relativeDue, STATUS_BY_ID, type Priority, type Status, type Task } from '@/lib/planner';
import { toDateStr } from '@/lib/contributions';
import { cn } from '@/lib/utils';

export function StatusDot({ status, className }: { status: Status; className?: string }) {
  return <span className={cn('inline-block size-2 shrink-0 rounded-full', STATUS_BY_ID[status].dot, className)} aria-label={STATUS_BY_ID[status].label} />;
}

export function PriorityChip({ priority, compact }: { priority: Priority; compact?: boolean }) {
  if (priority === 'none') return null;
  const p = PRIORITY_BY_ID[priority];
  return (
    <span className={cn('inline-flex items-center rounded px-1.5 py-px text-[0.62rem] font-bold tracking-wide uppercase', p.cls)}>
      {compact ? p.label[0] : p.label}
    </span>
  );
}

/** Due date, schedule, checklist and links — the metadata line shared by cards and rows. */
export function TaskMeta({ task, className }: { task: Task; className?: string }) {
  const cl = checklistProgress(task);
  const overdue = isOverdue(task);
  return (
    <div className={cn('text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.7rem]', className)}>
      <PriorityChip priority={task.priority} />
      {task.dueDate && (
        <span className={cn('inline-flex items-center gap-1', overdue && 'text-destructive font-semibold')}>
          <CalendarDays className="size-3" /> {relativeDue(task.dueDate)}
        </span>
      )}
      {task.scheduledAt && (
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="size-3" /> {relativeDue(toDateStr(new Date(task.scheduledAt)))} {formatTime(task.scheduledAt)}
        </span>
      )}
      {cl.total > 0 && (
        <span className={cn('inline-flex items-center gap-1', cl.done === cl.total && 'text-success')}>
          <CheckSquare className="size-3" /> {cl.done}/{cl.total}
        </span>
      )}
      {task.githubIssueUrl && <CircleDot className="size-3" aria-label="Linked GitHub issue" />}
      {task.meetingId && <MessageSquare className="size-3" aria-label="From a meeting" />}
      {task.tags.map((t) => (
        <span key={t} className="text-primary">
          #{t}
        </span>
      ))}
    </div>
  );
}
