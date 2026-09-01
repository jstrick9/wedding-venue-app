import { StrictMode } from 'react';
import { render, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UndoRedoProvider } from './UndoRedoContext';
import { emit, type UndoSnapshot } from '../utils/appEvents';

/**
 * Review #267 (Phase 4 batch 5 — FloorPlanCanvas/layout deep audit): F-267-1.
 *
 * The undo/redo history used to perform nested state updates INSIDE state
 * updaters (`setPast`/`setFuture`/`onRestore` called within another updater's
 * body). React updaters must be pure — StrictMode double-invokes them in
 * development, and concurrent rendering may replay them in production. Each
 * double-invoke appended a DUPLICATE entry to the undo stack, so one Ctrl+Z
 * press could fire onRestore twice and a second press appeared to do nothing
 * (it "undid" the duplicate). This test renders the provider inside StrictMode
 * (the app runs StrictMode in main.tsx) and pins the pure-updater behavior.
 */

const snap = (n: number): UndoSnapshot => ({
  tables: [{ n }],
  fixtures: [],
  decor: [],
  timestamp: n,
});

function pressUndo() {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
  });
}

function pressRedo() {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true }));
  });
}

describe('UndoRedoProvider keeps updaters pure (F-267-1)', () => {
  it('one undo press restores the previous snapshot exactly once', () => {
    const onRestore = vi.fn();
    render(
      <StrictMode>
        <UndoRedoProvider onRestore={onRestore}>
          <div />
        </UndoRedoProvider>
      </StrictMode>,
    );

    act(() => { emit('spm_push_undo_snapshot', snap(1)); });
    act(() => { emit('spm_push_undo_snapshot', snap(2)); });

    pressUndo();

    // The restore side effect must run exactly once per press — the buggy
    // nested-updater version fired it twice (once per double-invocation).
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledWith(snap(1));

    // History held exactly two snapshots; after undoing back to snapshot 1
    // there is nothing earlier left to restore (the duplicate-entry bug made
    // a second press "restore" snapshot 1 again).
    pressUndo();
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it('undo → redo round-trips under StrictMode', () => {
    const onRestore = vi.fn();
    render(
      <StrictMode>
        <UndoRedoProvider onRestore={onRestore}>
          <div />
        </UndoRedoProvider>
      </StrictMode>,
    );

    act(() => { emit('spm_push_undo_snapshot', snap(1)); });
    act(() => { emit('spm_push_undo_snapshot', snap(2)); });

    pressUndo();
    expect(onRestore).toHaveBeenLastCalledWith(snap(1));

    pressRedo();
    expect(onRestore).toHaveBeenLastCalledWith(snap(2));
    expect(onRestore).toHaveBeenCalledTimes(2);
  });
});
