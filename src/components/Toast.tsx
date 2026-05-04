import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  const colors = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    warning: 'bg-amber-600',
    info: 'bg-blue-600',
  };

  return (
    <div
      className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[10010] transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className={`${colors[type]} text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3`}>
        <span className="text-lg font-bold">{icons[type]}</span>
        <span className="font-medium">{message}</span>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
          className="ml-2 hover:bg-white/20 rounded-full p-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Toast container for managing multiple toasts
interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

let toastId = 0;
const toastListeners: ((toasts: ToastItem[]) => void)[] = [];
let currentToasts: ToastItem[] = [];

export function showToast(message: string, type: ToastType = 'info') {
  const id = String(++toastId);
  const newToast: ToastItem = { id, message, type };
  currentToasts = [...currentToasts, newToast];
  toastListeners.forEach(listener => listener(currentToasts));
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    removeToast(id);
  }, 3500);
}

function removeToast(id: string) {
  currentToasts = currentToasts.filter(t => t.id !== id);
  toastListeners.forEach(listener => listener(currentToasts));
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>(currentToasts);
  
  useEffect(() => {
    toastListeners.push(setToasts);
    return () => {
      const index = toastListeners.indexOf(setToasts);
      if (index > -1) toastListeners.splice(index, 1);
    };
  }, []);
  
  return { toasts, removeToast };
}

export function ToastContainer() {
  const { toasts, removeToast } = useToasts();
  
  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[10010] flex flex-col gap-2">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}
