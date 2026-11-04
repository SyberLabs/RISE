/**
 * The global error boundary's count (src/core/telemetry.js): an unhandled error or promise rejection is counted
 * as its class alone, once a page, so one that recurs every frame does not become a request every frame.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('./telemetry.js', () => ({ count: vi.fn() }));

import { count } from './telemetry.js';
import { errorBoundary } from './error-boundary.js';

describe('the error boundary', () => {
  it('counts an unhandled error or rejection once a page, as the class alone, with nothing of the error in it', () => {
    for (const level of ['error', 'log', 'group', 'groupEnd']) vi.spyOn(console, level).mockImplementation(() => {});
    errorBoundary.init();
    expect(count).not.toHaveBeenCalled();
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('Call me Ishmael'), message: 'Call me Ishmael' }));
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('again, every frame') }));
    const rejection = new Event('unhandledrejection');
    rejection.reason = new Error('rejected');
    window.dispatchEvent(rejection);
    expect(count.mock.calls).toEqual([['rise.app.failed', { class: 'unhandled' }]]);
    expect(errorBoundary.getRecentErrors()).toHaveLength(3);
  });
});
