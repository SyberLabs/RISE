// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { mountWormhole } from './wormhole.js';

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

function fixture() {
  document.body.innerHTML = `<main class="wormhole">
    <div id="prompt"><button id="jump">ENTER WORMHOLE</button></div><section id="destination" hidden>
      <strong id="title"></strong><p id="reason"></p><span id="coordinates"></span>
      <button id="dock">DOCK</button><button id="again">JUMP AGAIN</button>
      <button id="adjust">ADJUST COURSE</button></section>
    <p id="status" role="status"></p></main>`;
  return document.querySelector('.wormhole');
}

it('reveals an admitted destination, then hands its decision to the app on Dock', async () => {
  const root = fixture(), decision = { workId: 'ulysses', reason: 'A voyage', config: { wpm: 200 } };
  const request = vi.fn(async () => decision), save = vi.fn(), navigate = vi.fn();
  mountWormhole(root, { request, save, navigate, titleOf: async () => 'Ulysses', reduced: true });
  root.querySelector('#jump').click();
  await vi.waitFor(() => expect(root.querySelector('#destination').hidden).toBe(false));
  expect(root.querySelector('#title').textContent).toBe('Ulysses');
  expect(root.querySelector('#reason').textContent).toBe('A voyage');
  root.querySelector('#dock').click();
  expect(save).toHaveBeenCalledWith(decision, 'dock');
  expect(navigate).toHaveBeenCalledWith('/?invocation=wormhole');
});

it('can jump again and adjust a fresh plan without opening a session', async () => {
  const root = fixture(), decision = { workId: 'one', config: { wpm: 150 } };
  const request = vi.fn(async () => decision), save = vi.fn(), navigate = vi.fn();
  mountWormhole(root, { request, save, navigate, titleOf: async () => 'One', reduced: true });
  root.querySelector('#jump').click();
  await vi.waitFor(() => expect(root.querySelector('#destination').hidden).toBe(false));
  root.querySelector('#again').click();
  await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  await vi.waitFor(() => expect(root.querySelector('#destination').hidden).toBe(false));
  root.querySelector('#adjust').click();
  expect(save).toHaveBeenCalledWith(decision, 'adjust');
  expect(navigate).toHaveBeenCalledWith('/?invocation=wormhole');
});

it('keeps the launch available when the decision route fails', async () => {
  const root = fixture();
  mountWormhole(root, { request: async () => { throw new Error('Service unavailable'); }, reduced: true });
  root.querySelector('#jump').click();
  await vi.waitFor(() => expect(root.querySelector('#status').textContent).toContain('Service unavailable'));
  expect(root.querySelector('#jump').disabled).toBe(false);
  expect(root.querySelector('#destination').hidden).toBe(true);
});
