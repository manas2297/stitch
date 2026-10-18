import React from 'react';
import { LucideIcon, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: IconComponent = Sparkles,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-4 py-8 text-center', className)}>
      <div className="text-muted-foreground/70 inline-flex items-center justify-center">
        <IconComponent size={28} />
      </div>
      <div className="text-base font-bold">{title}</div>
      {description && (
        <div className="text-muted-foreground max-w-80 text-sm leading-relaxed">{description}</div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
