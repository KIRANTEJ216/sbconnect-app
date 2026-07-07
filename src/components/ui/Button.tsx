import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  children: ReactNode;
  loading?: boolean;
}

const base = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed select-none active:scale-[0.97] cursor-pointer';

const variants: Record<string, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover shadow-btn',
  outline: 'border border-border bg-surface text-primary hover:bg-primary-light hover:border-primary',
  ghost: 'text-steel hover:text-primary hover:bg-primary-light',
  danger: 'bg-danger text-white hover:bg-red-700',
};

const sizes: Record<string, string> = {
  xs: 'px-2 py-1 text-xs rounded-[0.5rem]',
  sm: 'px-3 py-1.5 text-sm rounded-[0.625rem]',
  md: 'px-5 py-2.5 text-sm rounded-[0.75rem]',
  lg: 'px-7 py-3 text-base rounded-[0.875rem]',
};

export function Button({ variant = 'primary', size = 'md', loading, children, className = '', ...props }: Props) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
