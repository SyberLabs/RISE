/**
 * Inside a host's sandboxed card the page has an opaque origin, and the
 * storage getters themselves throw. The return is taken at app.js's top level,
 * so a throw here is the whole app failing to load.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { sessionStorageOrNull, takeOpenRouterReturn } from './openrouter-callback.js';

const own = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');

afterEach(() => {
  if (own) Object.defineProperty(globalThis, 'sessionStorage', own);
  else delete globalThis.sessionStorage;
});

describe('an OpenRouter return in a page whose storage getter throws', () => {
  it('is taken as no return, and the page goes on loading', () => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() { throw new DOMException('The document is sandboxed and lacks the allow-same-origin flag.', 'SecurityError'); }
    });
    expect(sessionStorageOrNull()).toBeNull();
    expect(() => takeOpenRouterReturn()).not.toThrow();
    expect(takeOpenRouterReturn()).toBeNull();
  });
});
