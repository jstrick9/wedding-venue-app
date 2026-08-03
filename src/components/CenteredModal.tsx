import type { ReactNode } from 'react';

interface CenteredModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}

/**
 * A lightweight centered modal shell for card-style panels that don't render
 * their own overlay (Event Questions, Submission Status, Messages).
 */
export function CenteredModal({ title, onClose, children, maxWidth = 'max-w-2xl' }: CenteredModalProps) {
  return (
    <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-4">
      <div className={`w-full ${maxWidth} max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden`}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-[#4A1942] text-white">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="rounded-full p-1.5 hover:bg-white/20 text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
