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

// Node 25 exposes a global localStorage whose backing module fails to load inside jsdom,
// which breaks any test that touches Web Storage. Install a plain in-memory Storage instead.
if (typeof window !== 'undefined' && typeof window.localStorage?.clear !== 'function') {
  class MemoryStorage implements Storage {
    private store = new Map<string, string>();

    get length(): number {
      return this.store.size;
    }

    clear(): void {
      this.store.clear();
    }

    getItem(key: string): string | null {
      return this.store.has(key) ? this.store.get(key)! : null;
    }

    key(index: number): string | null {
      return Array.from(this.store.keys())[index] ?? null;
    }

    removeItem(key: string): void {
      this.store.delete(key);
    }

    setItem(key: string, value: string): void {
      this.store.set(String(key), String(value));
    }
  }

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    writable: true,
    value: new MemoryStorage(),
  });
}
