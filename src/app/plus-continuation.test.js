import { afterEach, expect, it } from 'vitest';
import { savePlusContinuation, readPlusContinuation, takePlusContinuation } from './plus-continuation.js';
afterEach(() => sessionStorage.clear());
it('keeps only a bounded own-text draft in this tab and consumes it once', () => {
  expect(savePlusContinuation('My own words.')).toBe(true);
  expect(readPlusContinuation()).toEqual({ schema: 1, text: 'My own words.', look: 'sample' });
  expect(takePlusContinuation().text).toBe('My own words.');
  expect(takePlusContinuation()).toBeNull();
  expect(savePlusContinuation('a'.repeat(5001))).toBe(false);
});
