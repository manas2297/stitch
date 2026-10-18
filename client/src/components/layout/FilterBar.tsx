import { Search } from 'lucide-react';
import type { ReactNode } from 'react';

import { Input } from '@/components/ui/input';

export default function FilterBar({
  value,
  onChange,
  placeholder,
  count,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  count: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="relative min-w-52 flex-1">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          className="pl-9"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={placeholder}
        />
      </div>
      {children}
      <span className="text-muted-foreground text-sm whitespace-nowrap">{count}</span>
    </div>
  );
}
