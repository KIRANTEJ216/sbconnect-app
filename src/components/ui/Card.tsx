import { memo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
}

export const Card = memo(function Card({ children, className = '' }: Props) {
  return (
    <div className={`bg-surface rounded-card border border-border shadow-card transition-all duration-300 hover:shadow-card-hover hover:border-primary/10 card-hover-glow ${className}`}>
      {children}
    </div>
  );
});

export const CardHeader = memo(function CardHeader({ children, className = '' }: Props) {
  return <div className={`px-5 sm:px-8 py-5 border-b border-border ${className}`}>{children}</div>;
});

export const CardContent = memo(function CardContent({ children, className = '' }: Props) {
  return <div className={`px-5 sm:px-8 py-6 ${className}`}>{children}</div>;
});
