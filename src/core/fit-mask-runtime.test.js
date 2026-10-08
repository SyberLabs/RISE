/**
 * The cold start of a Fit reading: a word the reader has been given plainly
 * stays long enough to read before the mask dresses it (PLAIN_DWELL_MS).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FitMaskRuntime } from './fit-mask-runtime.js';

function mounted(word) {
  const container = document.createElement('div');
  container.innerHTML = `<div id="atom-display">${word}</div><div class="fill-host is-hidden"></div>`;
  document.body.append(container);
  const runtime = new FitMaskRuntime({ container });
  runtime.sync = vi.fn(async () => {});
  return { runtime, atom: container.querySelector('#atom-display'), host: container.querySelector('.fill-host') };
}

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('a word the grace lets through', () => {
  it('keeps its dwell when the mask is ready just after: it is never dressed within a flash', () => {
    vi.useFakeTimers();
    const { runtime, atom, host } = mounted('Begin');
    runtime.holdForDressing(atom);
    expect(atom.classList.contains('is-mask-settling')).toBe(true);
    vi.advanceTimersByTime(600);
    expect(atom.classList.contains('is-mask-settling')).toBe(false);
    // The mask is ready 280ms after the word became visible.
    vi.advanceTimersByTime(280);
    runtime.reveal(atom, host);
    expect(atom.classList.contains('is-mask-ready')).toBe(false);
    expect(runtime.sync).not.toHaveBeenCalled();
    vi.advanceTimersByTime(470);
    expect(runtime.sync).toHaveBeenCalledOnce();
  });
});
