import React from 'react';
import { CircleNotch } from '@phosphor-icons/react';

/**
 * PRD v2 Button Component
 * - 44px min touch target (48px for submit)
 * - action-primary #047857 with #065F46 hover (WCAG AA 5.5:1+ contrast)
 * - Loading indicator with text preserves button size
 */
export const Button = React.forwardRef(function Button(
  {
    children,
    variant = 'primary', // 'primary' | 'secondary' | 'quiet' | 'danger'
    size = 'md',        // 'sm' (38px) | 'md' (44px) | 'lg' (48px) | 'submit' (48px)
    isLoading = false,
    loadingText,
    icon: Icon,
    iconPosition = 'left',
    className = '',
    disabled,
    type = 'button',
    ...props
  },
  ref
) {
  const baseClasses =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium cursor-pointer select-none transition-colors duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-[#6EE7B7] focus-visible:outline-offset-2';

  const sizeClasses = {
    sm: 'min-h-[38px] px-3 py-1.5 text-sm',
    md: 'min-h-[44px] px-4 py-2 text-base',
    lg: 'min-h-[48px] px-5 py-2.5 text-base font-semibold',
    submit: 'min-h-[48px] px-6 py-2.5 text-base font-semibold',
  }[size] || 'min-h-[44px] px-4 py-2 text-base';

  const variantClasses = {
    primary: 'bg-[#047857] text-white hover:bg-[#065F46] active:bg-[#064e3b] shadow-sm',
    secondary: 'bg-zinc-800 text-zinc-100 border border-zinc-700 hover:bg-zinc-700 hover:text-white hover:border-zinc-600',
    quiet: 'bg-transparent text-zinc-300 hover:text-white hover:bg-zinc-800/80',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-sm',
  }[variant] || 'bg-[#047857] text-white hover:bg-[#065F46]';

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <CircleNotch className="w-5 h-5 animate-spin" weight="bold" />
          <span>{loadingText || children}</span>
        </>
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon className="w-5 h-5 shrink-0" weight="bold" />}
          <span>{children}</span>
          {Icon && iconPosition === 'right' && <Icon className="w-5 h-5 shrink-0" weight="bold" />}
        </>
      )}
    </button>
  );
});
