import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  variant?: 'accent' | 'success' | 'warning' | 'danger' | 'neutral';
  className?: string;
}

const variants: Record<string, string> = {
  accent: 'bg-primary-light text-primary',
  success: 'bg-accent-light text-accent-hover',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-danger-light text-danger',
  neutral: 'bg-muted-bg text-steel',
};

export function Badge({ children, variant = 'accent', className = '' }: Props) {
  return (
    <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium tracking-tight ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
