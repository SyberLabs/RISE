/**
 * The Oracle: the object on RISE's home. A 1982 instrument whose round
 * window looks into a deep volume of phosphor fluid (orb.js draws it).
 *
 * This class owns only the object: its orientation, its churn, the words
 * sinking into and rising out of the fluid, and the ways a reader can
 * shake it (a flick of the object, or a shake of the phone). What the
 * words say, and what a shake does, belong to the room that holds it.
 *
 * It draws only between start() and stop(), so nothing renders behind a
 * reading. Reduced motion holds the object still and turns every sink and
 * rise into a short fade.
 */

import { createOrb, CAMERA, FOCAL } from './orb.js';
import './oracle.css';

const AXES = ['yaw', 'pitch', 'roll'];
const SINK_MS = 820;
const RISE_MS = 900;
const REDUCED_MS = 150;
// A flick faster than this (px/ms) is a shake; a slower drag only tilts.
const FLICK_SPEED = 1.6;
// Acceleration including gravity; a deliberate shake is well past this.
const JOLT = 24;
const JOLT_GAP_MS = 1500;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export class OracleObject {
  constructor(stage, { onShake = () => {} } = {}) {
    this.stage = stage;
    this.onShake = onShake;
    this.canvas = stage.querySelector('.oracle-canvas');
    this.glass = stage.querySelector('.oracle-glass');
    this.plate = stage.querySelector('.oracle-plate');
    this.reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)') ?? { matches: false };
    this.pos = { yaw: 0, pitch: 0, roll: 0 };
    this.vel = { yaw: 0, pitch: 0, roll: 0 };
    this.aim = { yaw: 0, pitch: 0, roll: 0 };
    this.churn = 0;
    this.glow = 0;
    this.busy = false;
    this.fit = 1;
    this.radiusPx = 200;
    this.running = false;
    this.frameId = 0;
    this.drag = null;
    this.lastJolt = 0;

    this.orb = null;
    try {
      this.orb = createOrb(this.canvas);
    } catch (error) {
      console.warn('[Oracle] renderer unavailable', error);
    }
    this.stage.classList.toggle('oracle-no-gl', !this.orb);

    this.onLost = () => this.stage.classList.add('oracle-no-gl');
    this.onRestored = () => { this.stage.classList.remove('oracle-no-gl'); this.layout(); };
    this.onResize = () => this.layout();
    this.onFrame = now => this.frame(now);
    this.onPointerDown = event => this.pointerDown(event);
    this.onPointerMove = event => this.pointerMove(event);
    this.onPointerUp = () => this.release();
    this.onMotion = event => this.motion(event);
    this.canvas.addEventListener('oracle-lost', this.onLost);
    this.canvas.addEventListener('oracle-restored', this.onRestored);
    this.stage.addEventListener('pointerdown', this.onPointerDown);
    this.stage.addEventListener('pointermove', this.onPointerMove);
    this.stage.addEventListener('pointerup', this.onPointerUp);
    this.stage.addEventListener('pointercancel', this.onPointerUp);
  }

  get still() {
    return this.reduced.matches;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.startedAt = this.last;
    addEventListener('resize', this.onResize);
    addEventListener('devicemotion', this.onMotion);
    this.layout();
    this.frameId = requestAnimationFrame(this.onFrame);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.frameId);
    removeEventListener('resize', this.onResize);
    removeEventListener('devicemotion', this.onMotion);
    this.drag = null;
  }

  destroy() {
    this.stop();
    this.canvas.removeEventListener('oracle-lost', this.onLost);
    this.canvas.removeEventListener('oracle-restored', this.onRestored);
    this.stage.removeEventListener('pointerdown', this.onPointerDown);
    this.stage.removeEventListener('pointermove', this.onPointerMove);
    this.stage.removeEventListener('pointerup', this.onPointerUp);
    this.stage.removeEventListener('pointercancel', this.onPointerUp);
  }

  layout() {
    const box = this.stage.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.fit = Math.min(1.2, (box.width / box.height) * 1.28);
    this.orb?.resize(box.width, box.height, dpr);
    // Pixels per world unit at the sphere's centre plane, from the shader's projection.
    this.radiusPx = (FOCAL / CAMERA) * this.fit * box.height / 2;
    this.stage.style.setProperty('--r', `${this.radiusPx}px`);
    this.stage.style.setProperty('--persp', `${CAMERA * this.radiusPx}px`);
  }

  frame(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.still) {
      for (const axis of AXES) this.pos[axis] = this.aim[axis] = this.vel[axis] = 0;
    } else {
      for (const axis of AXES) {
        this.vel[axis] += (-(this.pos[axis] - this.aim[axis]) * 34 - this.vel[axis] * 5.2) * dt;
        this.pos[axis] += this.vel[axis] * dt;
      }
    }
    this.churn = Math.max(0, this.churn - dt * 0.55);
    this.glow = Math.max(this.busy ? 0.6 : 0, this.glow - dt * 0.8);
    const time = this.still ? 8 : (now - this.startedAt) / 1000;
    const { yaw, pitch, roll } = this.pos;
    this.orb?.draw({ time, yaw, pitch, roll, churn: this.churn, glow: this.glow, fit: this.fit });
    // The words ride the window: the shader's rotation, in CSS's y-down convention.
    const turn = `rotateZ(${-roll}rad) rotateX(${-pitch}rad) rotateY(${yaw}rad)`;
    this.glass.style.transform = `${turn} translateZ(calc(var(--r) * .9))`;
    this.plate.style.transform = `${turn} rotateX(-44deg) translateZ(calc(var(--r) * 1.002))`;
    this.frameId = requestAnimationFrame(this.onFrame);
  }

  /** Stir the fluid and spin the object a little. */
  kick(strength = 1) {
    this.churn = Math.min(1.4, this.churn + strength);
    if (this.still) return;
    const r = () => (Math.random() - 0.5) * 2;
    this.vel.yaw += r() * 5 * strength;
    this.vel.pitch += r() * 4 * strength;
    this.vel.roll += r() * 6 * strength;
  }

  setBusy(busy) {
    this.busy = busy;
    if (busy) this.glow = 1;
  }

  /** The words in the glass sink into the fluid. */
  async sink() {
    this.glass.classList.remove('is-rising');
    this.glass.classList.add('is-sinking');
    await wait(this.still ? REDUCED_MS : SINK_MS);
  }

  /** Whatever the glass now holds rises out of the fluid. */
  async rise() {
    this.glass.classList.remove('is-sinking');
    this.glass.classList.add('is-rising');
    await wait(this.still ? REDUCED_MS : RISE_MS);
    this.glass.classList.remove('is-rising');
  }

  /**
   * iOS asks before it shares motion, and only inside a gesture. Called
   * from the reader's first ROLL, so shaking works from then on.
   */
  requestMotion() {
    const ask = globalThis.DeviceMotionEvent?.requestPermission;
    if (typeof ask !== 'function' || this.motionAsked) return;
    this.motionAsked = true;
    ask.call(DeviceMotionEvent).catch(() => {});
  }

  pointerDown(event) {
    if (event.target.closest('textarea, button, a')) return;
    this.drag = { x: event.clientX, y: event.clientY, t: performance.now(), vx: 0, vy: 0 };
    this.stage.setPointerCapture?.(event.pointerId);
  }

  pointerMove(event) {
    const drag = this.drag;
    if (!drag) return;
    const now = performance.now();
    const k = 1 / this.radiusPx;
    this.aim.yaw = Math.max(-0.7, Math.min(0.7, (event.clientX - drag.x) * k * 0.8));
    this.aim.pitch = Math.max(-0.6, Math.min(0.6, (event.clientY - drag.y) * k * 0.8));
    const dt = Math.max(1, now - drag.t);
    drag.vx = (event.clientX - (drag.px ?? drag.x)) / dt;
    drag.vy = (event.clientY - (drag.py ?? drag.y)) / dt;
    drag.px = event.clientX;
    drag.py = event.clientY;
    drag.t = now;
  }

  release() {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    this.aim.yaw = 0;
    this.aim.pitch = 0;
    if (Math.hypot(drag.vx, drag.vy) > FLICK_SPEED) this.onShake();
  }

  motion(event) {
    const a = event.accelerationIncludingGravity;
    if (!a) return;
    const now = performance.now();
    if (Math.hypot(a.x || 0, a.y || 0, a.z || 0) > JOLT && now - this.lastJolt > JOLT_GAP_MS) {
      this.lastJolt = now;
      this.onShake();
    }
  }
}
