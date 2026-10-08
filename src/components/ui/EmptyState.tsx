import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** Short noun for the icon, e.g. "business" — rendered as a lettered tile. */
  noun: string;
  title: string;
  body?: string;
  action?: ReactNode;
  /** Tones the tile so it reads as "nothing here yet" rather than "broken". */
  tone?: 'neutral' | 'primary';
  className?: string;
}

/**
 * The empty/zero state used across the app.
 *
 * Nineteen pages each rendered their own bare
 * `<p className="text-muted">No … found.</p>` — a single line of grey text with
 * no icon, no explanation and no way forward, which is the single biggest
 * contributor to a screen feeling unfinished. This gives every one of them an
 * icon tile, a headline, a sentence explaining what will appear here, and an
 * optional action.
 */
export function EmptyState({
  noun,
  title,
  body,
  action,
  tone = 'neutral',
  className = '',
}: EmptyStateProps) {
  const tile =
    tone === 'primary'
      ? 'bg-primary-light text-primary'
      : 'bg-muted-bg text-muted';

  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-6 py-10 ${className}`}
    >
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl ${tile} text-lg font-semibold tracking-tight`}
      >
        {noun.charAt(0).toUpperCase()}
      </span>
      <p className="mt-3 text-sm font-semibold text-charcoal tracking-tight">{title}</p>
      {body && <p className="mt-1 text-xs text-muted max-w-sm">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}