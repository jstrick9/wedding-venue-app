import React, { useId, useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ModalDialogProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export const ModalDialog: React.FC<ModalDialogProps> = ({
  title,
  description,
  onClose,
  children,
  className = '',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useFocusTrap(ref, true, onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`my-auto max-h-[90vh] w-full max-w-3xl flex flex-col rounded-xl bg-white shadow-xl ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 shrink-0 bg-white rounded-t-xl z-10">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-gray-900">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-0.5 text-sm text-gray-500">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors text-lg font-bold"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};

export default ModalDialog;