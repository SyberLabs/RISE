// @vitest-environment jsdom
/**
 * Home's ask dialog on its own: what it hands back (an answer, a failure, its
 * busy state) and where it says a failure. Asking through Home end to end is
 * Portal.jev.test.js.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HomeAsk } from './home-ask.js';
import { acceptOpenRouterKey, resetConnectionForTests } from '../core/ai-connection.js';

// jsdom has no modal dialogs; these do what the browser's do, minus the top layer.
HTMLDialogElement.prototype.showModal ||= function showModal() { this.open = true; };
HTMLDialogElement.prototype.close ||= function close() {
  if (!this.open) return;
  this.open = false;
  this.dispatchEvent(new Event('close'));
};

const KEY = 'sk-or-v1-home-ask-test-key-0123456789';
const DECISION = { workId: 'ulysses' };
const FAILED = 'Couldn’t interpret that here. Your request is kept.';

let parent;
beforeEach(() => {
  parent = document.createElement('div');
  document.body.append(parent);
});
afterEach(() => {
  resetConnectionForTests();
  document.body.innerHTML = '';
});

/** A dialog whose request resolves or rejects when the test says. */
function dialog() {
  let settle;
  const requestComposedReading = vi.fn(() => new Promise((resolve, reject) => { settle = { resolve, reject }; }));
  const options = {
    loadTools: async () => ({ requestComposedReading, validateJevRecommendation: () => {} }),
    onAnswer: vi.fn(),
    onFailure: vi.fn(),
    onBusy: vi.fn()
  };
  const asking = new HomeAsk(parent, options);
  return { asking, options, requestComposedReading, settle: () => settle };
}

const field = () => parent.querySelector('#home-intent');
const alertTitle = () => parent.querySelector('.home-ask-alert .portal-alert-title').textContent;
function submit(intent) {
  field().value = intent;
  parent.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

it('hands an admitted answer to Home, closes, and is busy only while it waits', async () => {
  acceptOpenRouterKey(KEY);
  const { asking, options, requestComposedReading, settle } = dialog();
  asking.open();
  submit('something slow about the sea');
  await vi.waitFor(() => expect(requestComposedReading).toHaveBeenCalledOnce());
  expect(requestComposedReading).toHaveBeenCalledWith('something slow about the sea', expect.objectContaining({ admit: expect.any(Function) }));
  expect(options.onBusy).toHaveBeenLastCalledWith(true);
  expect(parent.querySelector('[data-home="ask-cancel"]').disabled).toBe(true);
  // Escape cannot dismiss it while the request is in flight.
  const cancel = new Event('cancel', { cancelable: true });
  asking.dialog.dispatchEvent(cancel);
  expect(cancel.defaultPrevented).toBe(true);
  settle().resolve(DECISION);
  await vi.waitFor(() => expect(options.onAnswer).toHaveBeenCalledWith(DECISION, 'something slow about the sea'));
  expect(asking.dialog.open).toBe(false);
  expect(options.onBusy).toHaveBeenLastCalledWith(false);
  asking.destroy();
});

it('says a failure in the dialog while it is open, keeping the request', async () => {
  acceptOpenRouterKey(KEY);
  const { asking, options, settle } = dialog();
  asking.open();
  submit('tokyo drift');
  await vi.waitFor(() => expect(settle()).toBeTruthy());
  settle().reject(new Error('Jev timed out.'));
  await vi.waitFor(() => expect(alertTitle()).toBe(FAILED));
  expect(asking.dialog.open).toBe(true);
  expect(field().value).toBe('tokyo drift');
  expect(options.onFailure).not.toHaveBeenCalled();
  asking.destroy();
});

it('hands a failure to Home when the dialog closed while the request was in flight', async () => {
  acceptOpenRouterKey(KEY);
  const { asking, options, settle } = dialog();
  asking.open();
  submit('tokyo drift');
  await vi.waitFor(() => expect(settle()).toBeTruthy());
  asking.close();
  settle().reject(new Error('Jev timed out.'));
  await vi.waitFor(() => expect(options.onFailure).toHaveBeenCalledWith(FAILED, 'Jev timed out.'));
  expect(alertTitle()).toBe('');
  expect(options.onBusy).toHaveBeenLastCalledWith(false);
  asking.destroy();
});

it('offers a connection, not a field, until there is one, and becomes a field the moment there is', () => {
  const { asking } = dialog();
  asking.open();
  expect(field()).toBeNull();
  expect(parent.querySelector('h2').textContent).toBe('Asking needs your own AI.');
  acceptOpenRouterKey(KEY);
  expect(field()).not.toBeNull();
  asking.destroy();
  expect(parent.querySelector('dialog')).toBeNull();
});
