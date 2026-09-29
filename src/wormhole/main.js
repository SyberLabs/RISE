import './wormhole.css';
import { mountWormhole } from './wormhole.js';

const root = document.querySelector('.wormhole');
mountWormhole(root);

// A small, low resolution 2D scene: no WebGL dependency, no animation required
// for the controls. If canvas is unavailable the CSS horizon and polygon ship
// remain a complete instrument.
const canvas = document.querySelector('#starfield');
const context = canvas?.getContext?.('2d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

if (context) {
  const CELL = 2;                 // CSS pixels per drawn pixel: fine, but still pixels
  const IDLE = 0.03;              // a slow drift while the reader decides
  const CROSSING = 1.3;           // and a rush while the wormhole is entered
  const TINTS = ['#bad7d1', '#bad7d1', '#bad7d1', '#e8dec4', '#f1a472'];
  const stars = Array.from({ length: 150 }, (_, i) => ({
    angle: i * 2.39996,           // the golden angle spreads them evenly
    depth: ((i * 37) % 97) / 97,
    size: i % 9 === 0 ? 2 : 1,
    tint: TINTS[(i * 7) % TINTS.length]
  }));
  let last = 0, phase = 0, speed = IDLE, width = 0, height = 0;

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
    // Streaks only once the rush is well under way, so idle stars stay points.
    const streak = speed > 0.25 ? speed : 0;
    for (const star of stars) {
      const depth = (star.depth + phase) % 1;
      const reach = Math.pow(depth, 2.1);
      const x = Math.round(cx + Math.cos(star.angle) * reach * width * 0.7);
      const y = Math.round(cy + Math.sin(star.angle) * reach * height * 0.72);
      context.fillStyle = star.tint;
      context.globalAlpha = 0.2 + depth * 0.72;
      const length = 1 + Math.round(streak * depth * 6);
      // The streak trails back toward the gate along the star's own bearing.
      // Half-pixel steps, so a diagonal stays one line and not a row of dashes.
      const dx = Math.cos(star.angle), dy = Math.sin(star.angle);
      for (let step = 0; step <= length * 2; step += 1) {
        context.fillRect(Math.round(x - dx * step / 2), Math.round(y - dy * step / 2), star.size, star.size);
      }
    }
    context.globalAlpha = 1;
  }

  if (reduced.matches) {
    // One still frame; it is redrawn only when the picture changes size.
    draw();
    addEventListener('resize', draw);
  } else {
    const frame = now => {
      requestAnimationFrame(frame);
      if (document.hidden || now - last < 33) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      // Speed eases toward the crossing and back, instead of snapping.
      const target = root.classList.contains('is-jumping') ? CROSSING : IDLE;
      speed += (target - speed) * Math.min(1, dt * 3);
      phase += dt * speed;
      draw();
    };
    requestAnimationFrame(frame);
  }
} else {
  root.classList.add('no-canvas');
}

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
