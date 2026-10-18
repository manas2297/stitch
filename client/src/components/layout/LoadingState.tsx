import { Loader2 } from 'lucide-react';

export default function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
      <Loader2 className="size-4 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
      {children}
    </div>
  );
}
