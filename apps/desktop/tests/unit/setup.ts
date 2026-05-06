import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom doesn't ship ResizeObserver — stub it so cmdk (command palette) renders
if (typeof globalThis !== 'undefined' && !('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;
}

// jsdom doesn't ship scrollIntoView — stub on the prototype so cmdk's
// auto-scroll on selection doesn't blow up.
if (
  typeof window !== 'undefined' &&
  typeof window.HTMLElement !== 'undefined' &&
  !window.HTMLElement.prototype.scrollIntoView
) {
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoViewStub(): void {};
}

// jsdom doesn't ship matchMedia — stub it for theme store
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
