import { memo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  /**
   * Only for cards the user can actually act on. Static cards (read-only
   * summaries, leaderboards, ledgers) stay flat — lifting on hover implies
   * clickability, and a dashboard full of falsely-affordant cards trains people
   * to ignore the hover state entirely.
   */
  interactive?: boolean;
}

export const Card = memo(function Card({ children, className = '', interactive = false }: Props) {
  return (
    <div
      className={
        interactive
          ? `card-interactive bg-surface rounded-card border border-border shadow-card ${className}`
          : `bg-surface rounded-card border border-border shadow-card ${className}`
      }
    >
      {children}
    </div>
  );
});

export const CardHeader = memo(function CardHeader({ children, className = '' }: Props) {
  return <div className={`px-5 sm:px-7 py-4 sm:py-5 border-b border-border ${className}`}>{children}</div>;
});

export const CardContent = memo(function CardContent({ children, className = '' }: Props) {
  return <div className={`px-5 sm:px-7 py-5 sm:py-6 ${className}`}>{children}</div>;
});