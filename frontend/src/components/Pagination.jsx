import { CaretLeft, CaretRight } from "@phosphor-icons/react";

/**
 * Reusable pagination component for all data tables.
 *
 * @param {number}   page          – current 1-indexed page
 * @param {number}   totalPages    – total number of pages
 * @param {number}   totalItems    – total item count (before pagination)
 * @param {number}   pageSize      – items per page
 * @param {function} onPageChange  – callback(newPage)
 * @param {string}   [className]   – optional extra wrapper classes
 */
export default function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  className = "",
}) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  // Build visible page numbers (max 5 around current)
  const getPages = () => {
    const pages = [];
    let startP = Math.max(1, page - 2);
    let endP = Math.min(totalPages, page + 2);
    if (endP - startP < 4) {
      if (startP === 1) endP = Math.min(totalPages, startP + 4);
      else startP = Math.max(1, endP - 4);
    }
    for (let i = startP; i <= endP; i++) pages.push(i);
    return pages;
  };

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-zinc-800 ${className}`}
    >
      <p className="text-sm text-zinc-400">
        Showing{" "}
        <span className="font-semibold text-zinc-200">{start}</span> to{" "}
        <span className="font-semibold text-zinc-200">{end}</span> of{" "}
        <span className="font-semibold text-zinc-200">{totalItems}</span>{" "}
        results
      </p>

      <div className="flex items-center gap-1.5" role="navigation" aria-label="Pagination">
        {/* Prev */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border border-control text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <CaretLeft className="w-4 h-4" />
        </button>

        {/* Page numbers */}
        {getPages().map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? "page" : undefined}
            className={`min-w-[40px] min-h-[40px] rounded-lg text-sm font-medium transition-colors ${
              p === page
                ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                : "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 border border-transparent"
            }`}
          >
            {p}
          </button>
        ))}

        {/* Next */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border border-control text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <CaretRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
