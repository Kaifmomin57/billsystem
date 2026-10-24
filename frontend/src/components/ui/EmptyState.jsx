import React from 'react';
import { Button } from './Button';
import { Package } from '@phosphor-icons/react';

/**
 * PRD v2 EmptyState Component
 * - Explains what is empty
 * - Names the current context or filter if applicable
 * - Provides a clear, direct next action
 */
export function EmptyState({
  icon: Icon = Package,
  title = 'No records found',
  description = 'There are no items matching your criteria.',
  actionLabel,
  onAction,
  actionIcon,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-zinc-800 bg-zinc-900/40 my-4 ${className}`}>
      <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 mb-4 border border-zinc-700/60">
        <Icon className="w-7 h-7" weight="duotone" />
      </div>
      <h3 className="text-xl font-bold text-zinc-100 mb-1.5">{title}</h3>
      <p className="text-base text-zinc-300 max-w-md mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} icon={actionIcon} variant="primary">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
