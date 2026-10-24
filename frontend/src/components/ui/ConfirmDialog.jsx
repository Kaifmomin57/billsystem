import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { WarningCircle } from '@phosphor-icons/react';

/**
 * PRD v2 Destructive Action Confirmation Dialog
 * Rule: Must explicitly name the affected record in its confirmation message.
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  recordName,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  isDestructive = true,
  isLoading = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <div className="flex flex-col items-center text-center">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
          isDestructive ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
        }`}>
          <WarningCircle className="w-7 h-7" weight="bold" />
        </div>

        <h3 className="text-xl font-bold text-zinc-100 mb-2">{title}</h3>

        <div className="text-base text-zinc-300 mb-6">
          {message ? (
            <p>{message}</p>
          ) : (
            <p>
              Are you sure you want to delete <strong className="text-zinc-100 font-semibold">{recordName || 'this record'}</strong>? This action cannot be undone.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 w-full border-t border-zinc-800 pt-4">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={isDestructive ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
            loadingText="Processing…"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
