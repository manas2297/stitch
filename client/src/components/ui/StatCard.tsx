import { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Card, CardContent } from './card';

export interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  sublabel?: string;
  variant?: 'purple' | 'green' | 'blue' | 'orange' | 'teal' | 'pink';
  className?: string;
  onClick?: () => void;
}

const accent: Record<NonNullable<StatCardProps['variant']>, string> = {
  purple: 'from-[#7c3aed] to-[#a78bfa]',
  blue: 'from-[#2563eb] to-[#60a5fa]',
  green: 'from-[#059669] to-[#6ee7b7]',
  orange: 'from-[#d97706] to-[#fcd34d]',
  teal: 'from-[#0d9488] to-[#5eead4]',
  pink: 'from-[#be185d] to-[#f9a8d4]',
};

export function StatCard({
  icon: IconComponent,
  value,
  label,
  sublabel,
  variant = 'blue',
  className,
  onClick,
}: StatCardProps) {
  return (
    <Card
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        'relative gap-0 overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      <div className={cn('absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r', accent[variant])} />
      <CardContent>
        <div className="mb-2.5">
          <IconComponent size={20} />
        </div>
        <div className="mb-1 text-[2rem] leading-none font-extrabold tracking-tight">{value}</div>
        <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">{label}</div>
        {sublabel && <div className="text-muted-foreground mt-1 text-[0.68rem]">{sublabel}</div>}
      </CardContent>
    </Card>
  );
}
