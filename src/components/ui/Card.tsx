import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: Props) {
  return (
    <div className={`bg-surface rounded-card border border-border shadow-card transition-shadow duration-300 hover:shadow-card-hover ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: Props) {
  return <div className={`px-8 py-5 border-b border-border ${className}`}>{children}</div>;
}

export function CardContent({ children, className = '' }: Props) {
  return <div className={`px-8 py-6 ${className}`}>{children}</div>;
}
