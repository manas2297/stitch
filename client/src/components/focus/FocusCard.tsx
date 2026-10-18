import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** Titled card used across the Focus workspace. */
export default function FocusCard({
  icon: Icon,
  iconClassName = 'text-primary',
  title,
  badge,
  action,
  className,
  children,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  badge?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={cn('size-[18px] shrink-0', iconClassName)} />
          <span>{title}</span>
          {badge}
        </CardTitle>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
