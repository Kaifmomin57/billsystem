import React from 'react';
import { WarningCircle } from '@phosphor-icons/react';

/**
 * PRD v2 FormField Component
 * - Visible label
 * - Optional hint
 * - Inline error with WarningCircle icon
 */
export function FormField({
  label,
  htmlFor,
  required = false,
  error,
  hint,
  children,
  className = '',
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-2">
          <label htmlFor={htmlFor} className="block text-sm font-medium text-zinc-200">
            {label}
            {required && <span className="text-rose-400 ml-1" aria-hidden="true">*</span>}
          </label>
          {hint && <span className="text-xs text-zinc-400 leading-tight">{hint}</span>}
        </div>
      )}
      {children}
      {error && (
        <p className="text-sm text-rose-400 flex items-center gap-1.5 font-medium mt-0.5" role="alert">
          <WarningCircle className="w-4 h-4 shrink-0" weight="bold" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
