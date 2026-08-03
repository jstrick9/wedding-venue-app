import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';
import { emit } from './utils/appEvents';

/**
 * Regression test for the global storage-error surface: `spm_storage_error`
 * events must be surfaced as a toast even when the authenticated workspace is
 * not mounted (e.g. on the login screen / guest portal).
 */
describe('global storage error surface', () => {
  it('shows a toast when a storage error is emitted outside the workspace', async () => {
    localStorage.clear();
    render(<App />);

    // No active session → login screen is mounted. Emit a storage error and
    // confirm a toast appears thanks to the App-level listener + container.
    emit('spm_storage_error', {
      key: 'spm_test_key',
      error: 'Quota exceeded',
      action: 'save',
      timestamp: new Date().toISOString(),
    });

    // The message appears in both the live region and the toast; assert at
    // least one instance surfaced on the login screen.
    await waitFor(() => {
      expect(screen.getAllByText(/Could not save "spm_test_key"/).length).toBeGreaterThan(0);
    });
  });
});
