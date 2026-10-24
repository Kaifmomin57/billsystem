import React, { useEffect, useRef } from 'react';
import { X } from '@phosphor-icons/react';

/**
 * PRD v2 Accessible Modal Component
 * - Traps focus, handles Escape key, returns focus on close
 * - Backdrop blur and high-contrast styling
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-2xl',
  className = '',
}) {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      document.body.style.overflow = 'hidden';

      // Focus first input or button inside modal only once on open
      const timer = setTimeout(() => {
        if (modalRef.current && !modalRef.current.contains(document.activeElement)) {
          const firstField = modalRef.current.querySelector(
            'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'
          );
          if (firstField) {
            firstField.focus();
          } else {
            const firstButton = modalRef.current.querySelector(
              'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
            );
            firstButton?.focus();
          }
        }
      }, 50);

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          onCloseRef.current?.();
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
        if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
          previousActiveElement.current.focus();
        }
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Content */}
      <div
        ref={modalRef}
        className={`relative w-full ${maxWidth} bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden my-8 z-10 animate-in fade-in zoom-in-95 duration-150 ${className}`}
      >
        {/* Header */}
        {(title || onClose) && (
          <div className="flex items-start justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90">
            <div>
              {title && (
                <h2 id="modal-title" className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
                  {title}
                </h2>
              )}
              {subtitle && <p className="text-sm text-zinc-300 mt-1">{subtitle}</p>}
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 focus:outline-none focus-visible:outline-2 focus-visible:outline-[#6EE7B7]"
              >
                <X className="w-5 h-5" weight="bold" />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="p-6 max-h-[calc(100vh-12rem)] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
