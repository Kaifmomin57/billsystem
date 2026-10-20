import { ChevronLeft, ChevronRight } from "lucide-react";

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
      <p className="text-xs text-zinc-500">
        Showing{" "}
        <span className="font-semibold text-zinc-200">{start}</span> to{" "}
        <span className="font-semibold text-zinc-200">{end}</span> of{" "}
        <span className="font-semibold text-zinc-200">{totalItems}</span>{" "}
        results
      </p>

      <div className="flex items-center gap-1">
        {/* Prev */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page numbers */}
        {getPages().map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`min-w-[32px] h-8 rounded-lg text-xs font-medium transition-colors ${
              p === page
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-transparent"
            }`}
          >
            {p}
          </button>
        ))}

        {/* Next */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
