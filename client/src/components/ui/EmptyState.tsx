import React from 'react';
import { LucideIcon, Sparkles } from 'lucide-react';

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
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`empty-state ${className}`} style={{ padding: '2rem 1rem' }}>
      <div className="empty-state-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <IconComponent size={28} />
      </div>
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-desc">{description}</div>}
      {action && <div style={{ marginTop: '1rem' }}>{action}</div>}
    </div>
  );
}
