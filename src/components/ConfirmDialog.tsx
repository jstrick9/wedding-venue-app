import { useEffect, useRef } from 'react';
import { openConfirmDialog, closeConfirmDialog } from '../utils/modalEscape';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Accessible, non-blocking confirmation dialog used in place of the native
 * window.confirm() for a consistent, on-brand delete/confirm experience.
 * Focus is trapped and the confirm button is focused on open.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      confirmRef.current?.focus();
      openConfirmDialog();
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel();
      };
      window.addEventListener('keydown', onKey);
      return () => {
        closeConfirmDialog();
        window.removeEventListener('keydown', onKey);
      };
    }
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 id="confirm-dialog-title" className="text-lg font-semibold text-gray-900">
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-gray-600">{message}</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            ref={confirmRef}
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors ${
              tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#4A1942] hover:bg-[#3b1435]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
