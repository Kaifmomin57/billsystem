import React from 'react';
import { MoreActions } from './MoreActions';

/**
 * PRD v2 PageHeader Component
 * - Title and one-sentence purpose
 * - Maximum two primary header actions
 * - Overflow actions placed into MoreActions dropdown
 */
export function PageHeader({
  title,
  purpose,
  primaryAction,
  secondaryAction,
  moreActions = [],
  children,
  className = '',
}) {
  return (
    <div className={`page-header ${className}`}>
      <div>
        <h1 className="page-title">{title}</h1>
        {purpose && <p className="page-purpose">{purpose}</p>}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
        {secondaryAction}
        {primaryAction}
        {moreActions && moreActions.length > 0 && (
          <MoreActions items={moreActions} />
        )}
        {children}
      </div>
    </div>
  );
}

export default PageHeader;
