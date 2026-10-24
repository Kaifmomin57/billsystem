import React from 'react';

/**
 * PRD v2 Input Component
 * - 44px min height
 * - 16px text size (prevent mobile iOS zoom & ideal for 45+ age group)
 * - #71717A border-control (WCAG AA 3:1 non-text contrast)
 * - #6EE7B7 focus ring
 */
export const Input = React.forwardRef(function Input(
  {
    className = '',
    hasError = false,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    type = 'text',
    ...props
  },
  ref
) {
  const inputEl = (
    <input
      ref={ref}
      type={type}
      className={`w-full min-h-[44px] bg-zinc-900 border rounded-lg px-3.5 py-2 text-base text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-300 focus-visible:outline-2 focus-visible:outline-[#6EE7B7] focus-visible:outline-offset-2 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
        hasError
          ? 'border-rose-500 focus:border-rose-400 focus-visible:outline-rose-400'
          : 'border-[#71717A]'
      } ${LeftIcon ? 'pl-10' : ''} ${RightIcon ? 'pr-10' : ''} ${className}`}
      {...props}
    />
  );

  if (!LeftIcon && !RightIcon) return inputEl;

  return (
    <div className="relative flex items-center w-full">
      {LeftIcon && (
        <div className="absolute left-3 text-zinc-400 pointer-events-none flex items-center">
          <LeftIcon className="w-5 h-5" weight="bold" />
        </div>
      )}
      {inputEl}
      {RightIcon && (
        <div className="absolute right-3 text-zinc-400 flex items-center">
          <RightIcon className="w-5 h-5" weight="bold" />
        </div>
      )}
    </div>
  );
});

export const Select = React.forwardRef(function Select(
  {
    className = '',
    hasError = false,
    children,
    ...props
  },
  ref
) {
  return (
    <select
      ref={ref}
      className={`w-full min-h-[44px] bg-zinc-900 border rounded-lg px-3.5 py-2 text-base text-zinc-100 focus:outline-none focus:border-zinc-300 focus-visible:outline-2 focus-visible:outline-[#6EE7B7] focus-visible:outline-offset-2 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
        hasError
          ? 'border-rose-500 focus:border-rose-400'
          : 'border-[#71717A]'
      } ${className}`}
      {...props}
    >
      {children}
    </select>
  );
});
