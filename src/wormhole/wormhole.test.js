// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { coordinatesOf, describeDestination, mountWormhole } from './wormhole.js';
import { validateJevRecommendation } from '../app/jev-reading.js';
import { rollReading } from '../core/roll.js';

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

function fixture() {
  document.body.innerHTML = `<div class="wormhole">
    <span id="coordinates"></span>
    <main>
      <div id="prompt"><button id="jump">ENTER WORMHOLE</button></div>
      <section id="destination" hidden>
        <h2 id="title"></h2><p id="meta"></p><ul id="plan"></ul>
        <button id="dock">DOCK</button><button id="again">JUMP AGAIN</button>
        <button id="adjust">ADJUST COURSE</button></section>
      <p id="status" role="status"></p></main></div>`;
  return document.querySelector('.wormhole');
}

const shown = root => root.querySelector('#destination').hidden === false;

it('composes a destination on this device, and hands its decision to the app on Dock', async () => {
  const root = fixture(), save = vi.fn(), navigate = vi.fn();
  mountWormhole(root, { save, navigate, reduced: true });
  root.querySelector('#jump').click();
  await vi.waitFor(() => expect(shown(root)).toBe(true));
  expect(root.querySelector('#title').textContent).not.toBe('');
  expect(root.querySelector('#meta').textContent).toMatch(/ section$/u);
  expect([...root.querySelectorAll('#plan li')]).toHaveLength(4);
  expect(root.querySelector('#status').textContent).toContain('Destination found');
  expect(document.activeElement).toBe(root.querySelector('#dock'));

  root.querySelector('#dock').click();
  const [decision, action] = save.mock.calls[0];
  expect(action).toBe('dock');
  expect(decision.model).toBe('rise/roll-1');
  expect(() => validateJevRecommendation(decision)).not.toThrow();
  expect(navigate).toHaveBeenCalledWith('/?invocation=wormhole');
});

it('never jumps back to the work it just left, and can adjust the course it found', async () => {
  const root = fixture(), save = vi.fn(), navigate = vi.fn(), seen = [];
  mountWormhole(root, { save, navigate, reduced: true });
  root.querySelector('#jump').click();
  await vi.waitFor(() => expect(shown(root)).toBe(true));
  seen.push(root.querySelector('#title').textContent);
  for (let i = 0; i < 12; i += 1) {
    root.querySelector('#again').click();
    await vi.waitFor(() => expect(root.querySelector('#title').textContent).not.toBe(seen.at(-1)));
    seen.push(root.querySelector('#title').textContent);
  }
  expect(seen.slice(1).every((title, i) => title !== seen[i])).toBe(true);
  root.querySelector('#adjust').click();
  expect(save.mock.calls.at(-1)[1]).toBe('adjust');
  expect(navigate).toHaveBeenCalledWith('/?invocation=wormhole');
});

it('keeps the launch available, and says why, when a destination cannot be composed', async () => {
  const root = fixture();
  mountWormhole(root, { request: async () => { throw new Error('Service unavailable'); }, reduced: true });
  root.querySelector('#jump').click();
  await vi.waitFor(() => expect(root.querySelector('#status').textContent).toContain('Service unavailable'));
  expect(root.querySelector('#jump').disabled).toBe(false);
  expect(root.querySelector('#jump').hasAttribute('aria-disabled')).toBe(false);
  expect(root.querySelector('#destination').hidden).toBe(true);
  expect(document.activeElement).toBe(root.querySelector('#jump'));
});

it('stays put while it works: the control says it is busy, keeps focus, and ignores a second press', async () => {
  const root = fixture();
  let arrive;
  const request = vi.fn(() => new Promise(resolve => { arrive = resolve; }));
  mountWormhole(root, { request, reduced: true });
  const jump = root.querySelector('#jump');
  jump.focus();
  jump.click();
  expect(jump.getAttribute('aria-disabled')).toBe('true');
  expect(jump.disabled).toBe(false);
  expect(root.getAttribute('aria-busy')).toBe('true');
  expect(document.activeElement).toBe(jump);
  jump.click();
  expect(request).toHaveBeenCalledOnce();
  arrive(rollReading().decision);
  await vi.waitFor(() => expect(shown(root)).toBe(true));
  expect(root.hasAttribute('aria-busy')).toBe(false);
  expect(jump.hasAttribute('aria-disabled')).toBe(false);
});

it('will not hand anything over before a destination exists', () => {
  const root = fixture(), save = vi.fn(), navigate = vi.fn();
  mountWormhole(root, { save, navigate, reduced: true });
  root.querySelector('#dock').click();
  root.querySelector('#adjust').click();
  expect(save).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
});

it('says what could not be transferred when the browser refuses storage', async () => {
  const root = fixture(), navigate = vi.fn();
  mountWormhole(root, { save: () => { throw new Error('quota'); }, navigate, reduced: true });
  root.querySelector('#jump').click();
  await vi.waitFor(() => expect(shown(root)).toBe(true));
  root.querySelector('#dock').click();
  expect(navigate).not.toHaveBeenCalled();
  expect(root.querySelector('#status').textContent).toContain('could not transfer');
});

it('describes a destination in the words Home uses', () => {
  const { decision } = rollReading();
  const words = describeDestination(decision);
  expect(words.title).toBe(decision.title);
  expect(words.meta.startsWith(decision.author)).toBe(true);
  expect(words.plan).toHaveLength(4);
  // A decision that arrives without a title (an older Worker) is still named.
  expect(describeDestination({ workId: 'the-brothers-karamazov', config: decision.config }).title).toBe('The Brothers Karamazov');
});

it('reads the same coordinates for the same destination, and different ones for another', () => {
  const a = rollReading({ random: () => 0.1 }).decision, b = rollReading({ random: () => 0.9 }).decision;
  expect(coordinatesOf(a)).toBe(coordinatesOf(a));
  expect(coordinatesOf(a)).toMatch(/^X: \d{2}\.\d{3} {3}Y: \d{2}\.\d{3}$/u);
  expect(coordinatesOf(a)).not.toBe(coordinatesOf(b));
});

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'wormhole.css'), 'utf8');

it('removes motion under reduced motion, and never shortens a repeating animation into a flicker', () => {
  const reduced = css.slice(css.indexOf('prefers-reduced-motion'));
  expect(reduced).toContain('animation: none !important');
  expect(css).not.toContain('.01ms');
});

it('sets no text below 10px; what a reader must read is measured in the browser spec', () => {
  const sizes = [...css.matchAll(/font(?:-size)?:[^;]*?(\d+(?:\.\d+)?)px/gu)].map(match => Number(match[1]));
  expect(sizes.length).toBeGreaterThan(10);
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(10);
});
