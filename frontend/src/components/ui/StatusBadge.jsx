import React from 'react';
import {
  CheckCircle,
  Clock,
  WarningCircle,
  Info,
  MinusCircle,
} from '@phosphor-icons/react';

/**
 * PRD v2 StatusBadge Component
 * Rule: Always icon + text label, never color alone.
 */
export function StatusBadge({ status, label, className = '' }) {
  const normalized = (status || '').toLowerCase().replace(/_/g, ' ');

  let config = {
    icon: Info,
    text: label || 'Unknown',
    classes: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  };

  if (['paid', 'completed', 'active', 'success'].includes(normalized)) {
    config = {
      icon: CheckCircle,
      text: label || 'Paid',
      classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    };
  } else if (
    ['partial', 'partially paid', 'pending', 'review', 'in review', 'warning'].includes(normalized)
  ) {
    config = {
      icon: Clock,
      text: label || 'Partially Paid',
      classes: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    };
  } else if (
    ['due', 'payment due', 'unpaid', 'failed', 'error', 'inactive', 'cancelled'].includes(normalized)
  ) {
    config = {
      icon: WarningCircle,
      text: label || 'Payment Due',
      classes: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    };
  } else if (['draft', 'info'].includes(normalized)) {
    config = {
      icon: Info,
      text: label || 'Info',
      classes: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    };
  }

  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium border min-h-[28px] shrink-0 ${config.classes} ${className}`}
    >
      <Icon className="w-4 h-4 shrink-0" weight="bold" aria-hidden="true" />
      <span>{config.text}</span>
    </span>
  );
}
