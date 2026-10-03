import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  sublabel?: string;
  variant?: 'purple' | 'green' | 'blue' | 'orange' | 'teal' | 'pink';
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  icon: IconComponent,
  value,
  label,
  sublabel,
  variant = 'blue',
  className = '',
  onClick,
}: StatCardProps) {
  return (
    <div
      className={`overview-stat-card ${variant} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="overview-stat-icon">
        <IconComponent size={20} />
      </div>
      <div className="overview-stat-val">{value}</div>
      <div className="overview-stat-label">{label}</div>
      {sublabel && (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}
