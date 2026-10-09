import './wormhole.css';
import { mountAccountControl } from '../app/account-control.js';
mountAccountControl();
import { mountWormhole } from './wormhole.js';
import { createScene } from './scene.js';
import { initialScene, shipPose, stepScene } from './scene-state.js';
import { bearingOf } from './bearing.js';

const root = document.querySelector('.wormhole');
mountWormhole(root);

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const viewport = document.querySelector('.wh-viewport');

/**
 * The picture is drawn in depth (scene.js) where WebGL2 is available. Where it
 * is not, or after the GPU drops its context, the page keeps a small 2D scene:
 * a pixel starfield, CSS geometry and an SVG craft. Neither is ever needed to
 * use the controls.
 */
let flat = null;

function startFlat() {
  root.classList.remove('has-gl');
  if (flat) return flat.start();
  const canvas = document.querySelector('#starfield');
  const context = canvas?.getContext?.('2d');
  if (!context) { root.classList.add('no-canvas'); return undefined; }

  const CELL = 2;
  const IDLE = 0.03;
  const CROSSING = 1.3;
  const TINTS = ['#bad7d1', '#bad7d1', '#bad7d1', '#e8dec4', '#f1a472'];
  const stars = Array.from({ length: 150 }, (_, i) => ({
    angle: i * 2.39996,
    depth: ((i * 37) % 97) / 97,
    size: i % 9 === 0 ? 2 : 1,
    tint: TINTS[(i * 7) % TINTS.length]
  }));
  let last = 0, phase = 0, speed = IDLE, width = 0, height = 0, running = false;

  const fit = () => {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width / CELL)), h = Math.max(1, Math.round(rect.height / CELL));
    if (w === width && h === height) return;
    canvas.width = width = w;
    canvas.height = height = h;
    context.imageSmoothingEnabled = false;
  };

  function draw() {
    fit();
    context.clearRect(0, 0, width, height);
    const cx = width * 0.5, cy = height * 0.43;
    const streak = speed > 0.25 ? speed : 0;
    for (const star of stars) {
      const depth = (star.depth + phase) % 1;
      const reach = Math.pow(depth, 2.1);
      const x = Math.round(cx + Math.cos(star.angle) * reach * width * 0.7);
      const y = Math.round(cy + Math.sin(star.angle) * reach * height * 0.72);
      context.fillStyle = star.tint;
      context.globalAlpha = 0.2 + depth * 0.72;
      const length = 1 + Math.round(streak * depth * 6);
      const dx = Math.cos(star.angle), dy = Math.sin(star.angle);
      for (let step = 0; step <= length * 2; step += 1) {
        context.fillRect(Math.round(x - dx * step / 2), Math.round(y - dy * step / 2), star.size, star.size);
      }
    }
    context.globalAlpha = 1;
  }

  const frame = now => {
    if (!running) return;
    requestAnimationFrame(frame);
    if (document.hidden || now - last < 33) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    const target = root.classList.contains('is-jumping') ? CROSSING : IDLE;
    speed += (target - speed) * Math.min(1, dt * 3);
    phase += dt * speed;
    draw();
  };

  flat = {
    start() {
      if (reduced.matches) { draw(); addEventListener('resize', draw); return; }
      running = true;
      requestAnimationFrame(frame);
    },
    stop() { running = false; removeEventListener('resize', draw); }
  };
  return flat.start();
}

function startDeep(canvas) {
  const scene = createScene(canvas);
  if (!scene) return false;

  const state = initialScene();
  // Where the reader is pointing, as a bearing round the gate; undefined until they point.
  let aim;
  let last = 0, running = false, frameId = 0;

  const flags = () => ({
    jumping: root.classList.contains('is-jumping'),
    arrived: root.classList.contains('has-destination'),
    reduced: reduced.matches,
    aim
  });
  const fit = () => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width && rect.height) scene.resize(rect.width, rect.height, Math.min(devicePixelRatio || 1, 2));
  };
  const render = () => {
    scene.draw(state, shipPose(state));
    // The bearing the ship has reached, for anything that wants to watch it (a test, a reader's tools);
    // written only when it changes, so a ship at rest costs the page nothing.
    const shown = state.angle.toFixed(3);
    if (root.dataset.shipAngle !== shown) root.dataset.shipAngle = shown;
  };

  // A still frame when motion is reduced: redrawn only when something changes.
  const stillFrame = () => { stepScene(state, 0, flags()); render(); };

  const frame = now => {
    if (!running) return;
    frameId = requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    const dt = (now - last) / 1000 || 0;
    last = now;
    stepScene(state, dt, flags());
    render();
  };

  const start = () => {
    running = false;
    cancelAnimationFrame(frameId);
    fit();
    if (reduced.matches) { stillFrame(); return; }
    running = true;
    last = performance.now();
    frameId = requestAnimationFrame(frame);
  };

  new ResizeObserver(() => { fit(); if (reduced.matches) stillFrame(); }).observe(canvas);
  new MutationObserver(() => { if (reduced.matches) stillFrame(); }).observe(root, { attributes: true, attributeFilter: ['class'] });
  reduced.addEventListener?.('change', start);
  // The ship rides a ring round the gate and follows the pointer's bearing from it.
  // A mouse or pen is followed wherever it is on the page; a finger sends it with a tap.
  // Under reduced motion it does not follow: nothing moves until the reader asks for something.
  const point = event => {
    if (reduced.matches) return;
    const bearing = bearingOf(event.clientX, event.clientY, viewport.getBoundingClientRect());
    if (bearing !== null) aim = bearing;
  };
  window.addEventListener('pointermove', event => { if (event.pointerType !== 'touch') point(event); });
  viewport.addEventListener('pointerdown', event => { if (event.pointerType === 'touch') point(event); });
  canvas.addEventListener('scene-lost', () => { running = false; cancelAnimationFrame(frameId); startFlat(); });
  canvas.addEventListener('scene-restored', () => { flat?.stop(); root.classList.add('has-gl'); start(); });

  root.classList.add('has-gl');
  start();
  return true;
}

if (!startDeep(document.querySelector('#scene'))) startFlat();

// Silent by default; only a deliberate opt-in enables a brief synthesized cue.
const sound = document.querySelector('#sound');
const status = document.querySelector('#status');
let enabled = false, audio;
sound.addEventListener('click', () => {
  if (sound.getAttribute('aria-disabled') === 'true') return;
  enabled = !enabled;
  sound.setAttribute('aria-pressed', String(enabled));
  if (!enabled) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
  } catch {
    enabled = false;
    sound.setAttribute('aria-pressed', 'false');
    sound.setAttribute('aria-disabled', 'true');
    status.textContent = 'Sound is not available in this browser.';
  }
});

// The cue belongs to the crossing itself, so it follows the state, not a click.
new MutationObserver(() => { if (root.classList.contains('is-jumping')) cue(); })
  .observe(root, { attributes: true, attributeFilter: ['class'] });

function cue() {
  if (!enabled || !audio) return;
  const oscillator = audio.createOscillator(), gain = audio.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(170, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(330, audio.currentTime + 0.34);
  gain.gain.setValueAtTime(0.0001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.045, audio.currentTime + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.42);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.43);
}
