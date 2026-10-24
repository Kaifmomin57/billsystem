import React from 'react';

/**
 * PRD v2 Layout-shaped Skeleton Loader
 */
export function Skeleton({ className = '', height, width, rounded = 'rounded-md' }) {
  return (
    <div
      className={`bg-zinc-800/80 animate-pulse ${rounded} ${className}`}
      style={{
        height: height || undefined,
        width: width || undefined,
      }}
      aria-hidden="true"
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }) {
  return (
    <div className="w-full overflow-hidden border border-zinc-800 rounded-xl bg-zinc-900/50">
      <div className="h-12 bg-zinc-800/60 border-b border-zinc-700/80 px-4 flex items-center gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-zinc-800/60">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="min-h-[52px] h-[52px] px-4 flex items-center gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5 space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
