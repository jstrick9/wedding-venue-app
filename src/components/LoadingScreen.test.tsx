import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingScreen } from './LoadingScreen';

describe('LoadingScreen', () => {
  beforeEach(() => localStorage.clear());

  it('renders the label with an ellipsis', () => {
    render(<LoadingScreen />);
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('renders a custom label', () => {
    render(<LoadingScreen label="Loading your venue" />);
    expect(screen.getByText('Loading your venue…')).toBeTruthy();
  });

  it('renders a spinner with the configured primary color', () => {
    render(<LoadingScreen />);
    const spinner = document.querySelector('[class*="animate-spin"]');
    expect(spinner).toBeTruthy();
    expect((spinner as HTMLElement).style.borderTopColor).toBeTruthy();
  });
});
