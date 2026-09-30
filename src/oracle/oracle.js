import { createOrb, CAMERA, FOCAL } from './orb.js';

// Suggestions surface from the fluid when the Oracle is shaken. Each names moods
// and sounds Jev can actually choose (src/core/decision/recommend.js, src/core/jev-config.js).
const SUGGESTIONS = [
  'Something slow and calm tonight, with soft rain under the words.',
  'Fast phrases, bold type, and vivid psychedelic visuals.',
  'A haunted passage, read slowly in near darkness.',
  'Gentle piano under a short, hopeful reading.',
  'Make it feel like starlight: slow, wide, and quiet.',
  'Build toward a triumphant ending, large and bright.',
  'Quiet. No visuals. Just the words, one at a time.',
  'Something witty, with jazz and a brisk pace.',
  'A lullaby pace for a sleepy reader.',
  'Wonder and scale, like looking up at night.',
];

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const $ = s => document.querySelector(s);
const stage = $('.oracle-stage'), canvas = $('.oracle-canvas'), glass = $('.oracle-glass'), plate = $('.oracle-plate');
const field = $('#oracle-intent'), status = $('.oracle-status');
const shakeKey = $('.oracle-key-shake'), askKey = $('.oracle-key-ask');

const orb = (() => { try { return createOrb(canvas); } catch (e) { console.warn('Oracle renderer unavailable', e); return null; } })();
if (!orb) document.documentElement.classList.add('oracle-no-gl');
// If the GPU drops the context, show the CSS object until it comes back.
canvas.addEventListener('oracle-lost', () => document.documentElement.classList.add('oracle-no-gl'));
canvas.addEventListener('oracle-restored', () => { document.documentElement.classList.remove('oracle-no-gl'); layout(); });

// Orientation: a damped spring per axis. Drag sets an offset target; shakes add velocity.
const axes = ['yaw', 'pitch', 'roll'];
const pos = { yaw: 0, pitch: 0, roll: 0 }, vel = { yaw: 0, pitch: 0, roll: 0 }, aim = { yaw: 0, pitch: 0, roll: 0 };
let churn = 0, glow = 0, fit = 1, radiusPx = 200, last = performance.now(), start = last, busy = false;

function layout() {
  const r = stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  fit = Math.min(1.2, r.width / r.height * 1.28);
  orb?.resize(r.width, r.height, dpr);
  // Pixels per world unit at the sphere's center plane, from the shader's projection.
  radiusPx = FOCAL / CAMERA * fit * r.height / 2;
  stage.style.setProperty('--r', `${radiusPx}px`);
  stage.style.setProperty('--persp', `${CAMERA * radiusPx}px`);
}

function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (!reduced.matches) for (const a of axes) {
    const k = 34, c = 5.2;
    vel[a] += (-(pos[a] - aim[a]) * k - vel[a] * c) * dt;
    pos[a] += vel[a] * dt;
  } else for (const a of axes) pos[a] = aim[a] = vel[a] = 0;
  churn = Math.max(0, churn - dt * .55); glow = Math.max(busy ? .6 : 0, glow - dt * .8);
  const time = reduced.matches ? 8 : (now - start) / 1000;
  orb?.draw({ time, yaw: pos.yaw, pitch: pos.pitch, roll: pos.roll, churn, glow, fit });
  // The text rides the window: same rotation as the shader, in CSS's y-down convention.
  const tr = `rotateZ(${-pos.roll}rad) rotateX(${-pos.pitch}rad) rotateY(${pos.yaw}rad)`;
  glass.style.transform = `${tr} translateZ(calc(var(--r) * .9))`;
  plate.style.transform = `${tr} rotateX(-44deg) translateZ(calc(var(--r) * 1.002))`;
  requestAnimationFrame(frame);
}

function kick(strength = 1) {
  if (reduced.matches) return;
  const r = () => (Math.random() - .5) * 2;
  vel.yaw += r() * 5 * strength; vel.pitch += r() * 4 * strength; vel.roll += r() * 6 * strength;
  churn = Math.min(1.4, churn + strength);
}

// Shake: the current words sink into the fluid and a new suggestion rises out of it.
let shaking = false, lastSuggestion = -1;
async function shake() {
  if (shaking || busy) return;
  shaking = true;
  kick(1.1);
  glass.classList.add('is-sinking');
  status.textContent = '';
  await wait(reduced.matches ? 150 : 820);
  let i; do { i = Math.floor(Math.random() * SUGGESTIONS.length); } while (i === lastSuggestion);
  lastSuggestion = i;
  field.value = SUGGESTIONS[i];
  glass.classList.remove('is-sinking'); glass.classList.add('is-rising');
  status.textContent = 'A suggestion surfaced. Edit it or ask Jev.';
  await wait(reduced.matches ? 150 : 900);
  glass.classList.remove('is-rising');
  shaking = false;
}

// Ask: hand the request to RISE Home, where the reader's own AI connection
// lives (their OpenRouter account, or Kev in local RISE). This page holds no
// model connection of its own, so it never asks a model itself.
// Same key and shape as Portal.js rememberIntent.
const HOME_DRAFT_KEY = 'rise-jev-preview-v1';
function ask() {
  const intent = field.value.trim();
  if (intent.length < 3 || intent.length > 240) {
    status.textContent = intent ? 'Keep it under 240 characters.' : 'Type what you would like to read, or shake for an idea.';
    field.focus(); kick(.25); return;
  }
  busy = true; glow = 1; churn = Math.max(churn, .6);
  askKey.setAttribute('aria-busy', 'true'); field.readOnly = true;
  try {
    sessionStorage.setItem(HOME_DRAFT_KEY, JSON.stringify({ intent: '', draft: intent }));
    status.textContent = 'Taking your request to RISE Home. Connect OpenRouter or run RISE locally there to ask Jev.';
    setTimeout(() => location.assign('/'), reduced.matches ? 0 : 700);
  } catch {
    status.textContent = 'This browser blocked the handoff. Copy your request to the RISE home page.';
    busy = false; askKey.removeAttribute('aria-busy'); field.readOnly = false;
    kick(.3);
  }
}

const wait = ms => new Promise(r => setTimeout(r, ms));

// Drag to tilt; a fast flick is a shake.
let drag = null;
stage.addEventListener('pointerdown', e => {
  if (e.target.closest('textarea, button')) return;
  drag = { x: e.clientX, y: e.clientY, t: performance.now(), vx: 0, vy: 0 };
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', e => {
  if (!drag) return;
  const now = performance.now(), dx = e.clientX - drag.x, dy = e.clientY - drag.y, k = 1 / radiusPx;
  aim.yaw = Math.max(-.7, Math.min(.7, dx * k * .8)); aim.pitch = Math.max(-.6, Math.min(.6, dy * k * .8));
  const dt = Math.max(1, now - drag.t); drag.vx = (e.clientX - (drag.px ?? drag.x)) / dt; drag.vy = (e.clientY - (drag.py ?? drag.y)) / dt;
  drag.px = e.clientX; drag.py = e.clientY; drag.t = now;
});
const release = () => {
  if (!drag) return;
  const speed = Math.hypot(drag.vx, drag.vy);
  aim.yaw = aim.pitch = 0; drag = null;
  if (speed > 1.6) shake();
};
stage.addEventListener('pointerup', release); stage.addEventListener('pointercancel', release);

// Shaking a phone works where motion events are available without a permission prompt.
let lastJolt = 0;
addEventListener('devicemotion', e => {
  const a = e.accelerationIncludingGravity; if (!a) return;
  const m = Math.hypot(a.x || 0, a.y || 0, a.z || 0), now = performance.now();
  if (m > 24 && now - lastJolt > 1500) { lastJolt = now; shake(); }
});

shakeKey.addEventListener('click', shake);
askKey.addEventListener('click', ask);
field.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } });
addEventListener('resize', layout);
layout();
requestAnimationFrame(frame);
