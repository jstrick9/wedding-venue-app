import { createContext, useContext, useCallback, useEffect, useRef, useState, ReactNode } from 'react';
import { on } from '../utils/appEvents';

interface LayoutSnapshot {
  tables: any[];
  fixtures: any[];
  decor: any[];
  timestamp: number;
}

interface UndoRedoContextType {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  pushSnapshot: (snapshot: LayoutSnapshot) => void;
  clearHistory: () => void;
  historyLength: number;
}

const UndoRedoContext = createContext<UndoRedoContextType | null>(null);

const MAX_HISTORY = 50;

export function useUndoRedo(): UndoRedoContextType {
  const context = useContext(UndoRedoContext);
  if (!context) {
    throw new Error('useUndoRedo must be used within UndoRedoProvider');
  }
  return context;
}

interface UndoRedoProviderProps {
  children: ReactNode;
  onRestore: (snapshot: LayoutSnapshot) => void;
}

export function UndoRedoProvider({ children, onRestore }: UndoRedoProviderProps) {
  const [past, setPast] = useState<LayoutSnapshot[]>([]);
  const [future, setFuture] = useState<LayoutSnapshot[]>([]);
  // F-267-1 (Review #267): the newest snapshot is internal bookkeeping (never
  // rendered, not exposed on the context), so it lives in a ref. The previous
  // implementation performed nested state updates (`setPast`/`setFuture`/
  // `onRestore`) INSIDE state updaters — but React updaters must be pure:
  // StrictMode double-invokes them in development (the app runs StrictMode in
  // main.tsx) and concurrent rendering may replay them in production. Every
  // double-invoke appended a duplicate undo-history entry, so one Ctrl+Z press
  // restored twice and the next press appeared to do nothing.
  const currentSnapshotRef = useRef<LayoutSnapshot | null>(null);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const pushSnapshot = useCallback((snapshot: LayoutSnapshot) => {
    const prev = currentSnapshotRef.current;
    currentSnapshotRef.current = snapshot;
    if (prev) {
      setPast((p) => {
        const newPast = [...p, prev];
        if (newPast.length > MAX_HISTORY) {
          newPast.shift();
        }
        return newPast;
      });
    }
    // Clear future when a new action is taken.
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const current = currentSnapshotRef.current;
    setPast(past.slice(0, -1));
    if (current) setFuture((f) => [current, ...f]);
    currentSnapshotRef.current = previous;
    onRestore(previous);
  }, [past, onRestore]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const current = currentSnapshotRef.current;
    setFuture(future.slice(1));
    if (current) {
      setPast((p) => {
        const newPast = [...p, current];
        if (newPast.length > MAX_HISTORY) {
          newPast.shift();
        }
        return newPast;
      });
    }
    currentSnapshotRef.current = next;
    onRestore(next);
  }, [future, onRestore]);

  const clearHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
    currentSnapshotRef.current = null;
  }, []);

  // Listen for snapshot events from the app
  useEffect(() => {
    return on('spm_push_undo_snapshot', (snapshot) => {
      pushSnapshot(snapshot);
    });
  }, [pushSnapshot]);

  // Clear undo/redo history when the working layout is replaced (venue switch,
  // load-layout, load-template) so Undo can't restore a different layout.
  useEffect(() => {
    return on('spm_clear_undo_history', () => clearHistory());
  }, [clearHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      
      if (isCtrlOrMeta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (isCtrlOrMeta && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (isCtrlOrMeta && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <UndoRedoContext.Provider
      value={{
        canUndo,
        canRedo,
        undo,
        redo,
        pushSnapshot,
        clearHistory,
        historyLength: past.length,
      }}
    >
      {children}
    </UndoRedoContext.Provider>
  );
}