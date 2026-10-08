import { memo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  variant?: 'accent' | 'success' | 'warning' | 'danger' | 'neutral' | 'gold' | 'info';
  className?: string;
}

const variants: Record<string, string> = {
  accent: 'bg-primary-light text-primary border-primary/15',
  success: 'bg-success-light text-success-strong border-success/15',
  warning: 'bg-warning-light text-warning border-warning/20',
  danger: 'bg-danger-light text-danger-strong border-danger/15',
  neutral: 'bg-muted-bg text-steel border-border',
  gold: 'bg-gold-light text-gold border-gold/25',
  info: 'bg-info-light text-info border-info/15',
};

export const Badge = memo(function Badge({ children, variant = 'accent', className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-micro font-semibold tracking-tight border ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
});