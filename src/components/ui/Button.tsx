import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gold';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  children: ReactNode;
  loading?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-1.5 font-medium leading-none ' +
  'transition-[background-color,box-shadow,transform,color] duration-200 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring ' +
  'disabled:opacity-45 disabled:pointer-events-none select-none active:scale-[0.975] cursor-pointer';

const variants: Record<string, string> = {
  primary:
    'bg-primary text-white shadow-btn hover:bg-primary-hover hover:shadow-btn-hover gradient-accent-btn',
  secondary:
    'bg-secondary text-white shadow-sm hover:brightness-110',
  outline:
    'border border-border-strong bg-surface text-charcoal hover:bg-muted-bg hover:border-primary-ring hover:text-primary',
  ghost:
    'text-steel hover:text-primary hover:bg-primary-lighter',
  danger:
    'bg-danger text-white shadow-sm hover:bg-danger-strong hover:shadow-md',
  // Bright gold with ink text (7.9:1). White-on-gold only reached 3.2:1.
  gold:
    'bg-gold-bright text-ink shadow-sm hover:brightness-95',
};

/**
 * Every size clears the 44x44px touch-target minimum (WCAG 2.5.5 / the iOS
 * HIG). The previous scale was 28 / 32 / 40 / 48px, so every button in the app
 * was under the minimum — `size="lg"` was the only conforming step and it was
 * never used. Density is now expressed with padding and font size instead of a
 * shorter box, which keeps rows visually compact without shrinking the hit area.
 */
const sizes: Record<string, string> = {
  xs: 'h-11 px-2.5 text-xs rounded-xs',
  sm: 'h-11 px-3 text-xs rounded-sm',
  md: 'h-11 px-4 text-sm rounded-btn',
  lg: 'h-12 px-6 text-body rounded-md',
};

export function Button({ variant = 'primary', size = 'md', loading, children, className = '', ...props }: Props) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <svg className="animate-spin shrink-0 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}