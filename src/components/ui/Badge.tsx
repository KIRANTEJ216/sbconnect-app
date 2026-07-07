import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  variant?: 'accent' | 'success' | 'warning' | 'danger' | 'neutral';
  className?: string;
}

const variants: Record<string, string> = {
  accent: 'bg-primary-light text-primary border border-primary/10',
  success: 'bg-accent-light text-accent-hover border border-accent/10',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200/50',
  danger: 'bg-danger-light text-danger border border-danger/10',
  neutral: 'bg-muted-bg text-steel border border-border/50',
};

export function Badge({ children, variant = 'accent', className = '' }: Props) {
  return (
    <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium tracking-tight ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
