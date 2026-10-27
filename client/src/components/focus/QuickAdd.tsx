import { useState } from 'react';
import { CalendarDays, CornerDownLeft, Plus } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { parseQuickAdd, relativeDue, type Status, type TaskPatch } from '@/lib/planner';
import { cn } from '@/lib/utils';
import { useToast } from '../Toast';
import { PriorityChip } from './taskBits';

/** One-line task entry: "Fix login !high #auth @tomorrow". */
export default function QuickAdd({
  onCreate,
  status = 'todo',
  extra,
  placeholder = 'Add a task…  try  !high  #api  @tomorrow',
  className,
  autoFocus,
}: {
  onCreate: (patches: TaskPatch[]) => Promise<unknown>;
  status?: Status;
  extra?: TaskPatch;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const toast = useToast();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const parsed = parseQuickAdd(value);
  const hasTokens = !!(parsed.priority || parsed.dueDate || parsed.tags?.length);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed.title || busy) return;
    setBusy(true);
    try {
      await onCreate([{ status, ...extra, ...parsed }]);
      setValue('');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={cn('flex flex-col gap-1.5', className)}>
      <div className="relative">
        <Plus className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="pr-9 pl-8"
          aria-label="New task"
          autoFocus={autoFocus}
        />
        {value && <CornerDownLeft className="text-muted-foreground absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2" aria-hidden />}
      </div>
      {hasTokens && (
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 px-1 text-[0.7rem]">
          <span className="text-foreground font-medium">{parsed.title || '…'}</span>
          {parsed.priority && <PriorityChip priority={parsed.priority} />}
          {parsed.dueDate && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3" /> {relativeDue(parsed.dueDate)}
            </span>
          )}
          {parsed.tags?.map((t) => (
            <span key={t} className="text-primary">
              #{t}
            </span>
          ))}
        </div>
      )}
    </form>
  );
}
