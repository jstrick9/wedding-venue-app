import '@testing-library/jest-dom/vitest';
import { beforeEach, afterEach, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});
