import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className = '', style, ...props }: CardProps) {
  return (
    <div
      className={`focus-card ${className}`.trim()}
      style={{
        background: '#ffffff',
        border: '1px solid var(--border-color)',
        borderRadius: '14px',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', style, ...props }: CardProps) {
  return (
    <div
      className={`card-header ${className}`.trim()}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '0.75rem',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '', style, ...props }: CardProps) {
  return (
    <h3
      className={`card-title ${className}`.trim()}
      style={{
        fontSize: '0.95rem',
        fontWeight: 600,
        color: 'var(--text-color)',
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        ...style,
      }}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardContent({ children, className = '', style, ...props }: CardProps) {
  return (
    <div className={`card-content ${className}`.trim()} style={style} {...props}>
      {children}
    </div>
  );
}
