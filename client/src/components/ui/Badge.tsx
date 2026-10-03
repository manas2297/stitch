import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'green' | 'orange' | 'red' | 'blue' | 'purple' | 'muted';
  className?: string;
  style?: React.CSSProperties;
}

export function Badge({
  children,
  variant = 'default',
  className = '',
  style,
}: BadgeProps) {
  const variantClass = variant === 'default' ? '' : `badge-${variant}`;
  return (
    <span className={`badge ${variantClass} ${className}`.trim()} style={style}>
      {children}
    </span>
  );
}
