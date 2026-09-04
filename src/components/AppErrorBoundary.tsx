import React from 'react';
import { getConfig } from '../config';

interface AppErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application error boundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetLocalData = () => {
    try {
      // Back up every app key before wiping so a mistaken reset isn't fatal.
      const snapshot: Record<string, string> = {};
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith('spm_') || key.startsWith('wedding-layout-')) {
          const raw = localStorage.getItem(key);
          if (raw != null) snapshot[key] = raw;
        }
      });
      try {
        localStorage.setItem(
          'spm_backup_emergency_reset',
          JSON.stringify({ savedAt: new Date().toISOString(), data: snapshot }),
        );
      } catch {
        // Backup itself failed (e.g. quota) — continue with the reset anyway.
      }
      Object.keys(snapshot).forEach((key) => localStorage.removeItem(key));
    } catch (e) {
      console.error('Failed to clear local data:', e);
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const primary = getConfig().primaryColor;
    const primaryDark = getConfig().primaryDark;
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#4A1942] via-[#3d1a45] to-[#1a0a14] flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-6 text-white text-center" style={{ background: `linear-gradient(135deg, ${primary} 0%, ${primaryDark} 100%)` }}>
            <div className="text-5xl mb-3">⚠️</div>
            <h1 className="text-2xl font-bold">Application Recovery</h1>
            <p className="text-white/80 text-sm mt-2">
              The planner hit an unexpected startup issue. You can safely reload or reset saved app data.
            </p>
          </div>

          <div className="p-6 space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="font-semibold mb-1">What happened?</div>
              <div>
                A runtime error prevented the app from loading normally. This is often caused by stale or corrupted saved app data.
              </div>
            </div>

            {this.state.error && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                The error was recorded for support. Reload the application, or contact support if the problem continues.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={this.handleReload}
                className="px-4 py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: primary }}
              >
                Reload App
              </button>
              <button
                onClick={this.handleResetLocalData}
                className="px-4 py-3 rounded-xl font-semibold border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
              >
                Reset Saved App Data
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
