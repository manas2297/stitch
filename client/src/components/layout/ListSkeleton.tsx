import { Skeleton } from '@/components/ui/skeleton';

export default function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border p-4">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="hidden h-5 w-16 sm:block" />
        </div>
      ))}
    </div>
  );
}
