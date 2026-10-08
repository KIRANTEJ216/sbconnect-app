import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-charcoal tracking-tight">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={
            `w-full rounded-input border bg-surface px-3.5 py-2.5 text-body text-charcoal ` +
            `placeholder:text-faint transition-[border-color,box-shadow] duration-150 ` +
            `focus:outline-none focus:ring-[3px] focus:ring-primary-ring/20 ` +
            (error
              ? 'border-danger focus:border-danger focus:ring-danger/20'
              : 'border-border hover:border-border-strong focus:border-primary') +
            ` ${className}`
          }
          {...props}
        />
        {error ? (
          <p id={`${inputId}-error`} role="alert" className="text-xs text-danger">{error}</p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="text-xs text-muted">{hint}</p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';