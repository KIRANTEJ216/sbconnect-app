import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, className = '', ...props }, ref) => (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-charcoal tracking-tight">{label}</label>
      )}
      <input
        ref={ref}
        className={`w-full rounded-input border ${error ? 'border-danger' : 'border-border'} bg-surface px-4 py-2.5 text-sm text-charcoal placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary transition-all duration-200 ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  ),
);

Input.displayName = 'Input';
