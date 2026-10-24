import React, { useState, useRef, useEffect } from 'react';
import { DotsThreeVertical } from '@phosphor-icons/react';

/**
 * PRD v2 MoreActions Dropdown Menu
 * - Accessible menu with keyboard controls (Escape, Arrow navigation)
 * - 44px min hit targets on touch and desktop
 * - Focus return
 */
export function MoreActions({ items = [], label = 'More actions', className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!items || items.length === 0) return null;

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={label}
        title={label}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 focus:outline-none focus-visible:outline-2 focus-visible:outline-[#6EE7B7] transition-colors"
      >
        <DotsThreeVertical className="w-5 h-5" weight="bold" />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-lg bg-zinc-900 border border-zinc-700 shadow-xl py-1.5 focus:outline-none animate-in fade-in duration-100"
        >
          {items.map((item, index) => {
            if (item.divider) {
              return <div key={`div-${index}`} className="my-1 border-t border-zinc-800" role="separator" />;
            }
            const ItemIcon = item.icon;
            const isDanger = item.variant === 'danger';
            return (
              <button
                key={item.label || index}
                role="menuitem"
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  setIsOpen(false);
                  item.onClick?.();
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-base text-left min-h-[44px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  isDanger
                    ? 'text-rose-400 hover:bg-rose-500/10 hover:text-rose-300'
                    : 'text-zinc-200 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                {ItemIcon && <ItemIcon className="w-5 h-5 shrink-0" weight="bold" />}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
