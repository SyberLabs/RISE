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
  const stars = Array.from({ length: 78 }, (_, i) => ({
    angle: i * 2.39996, depth: ((i * 37) % 97) / 97, size: i % 8 === 0 ? 2 : 1
  }));
  let last = 0, phase = 0, width = 0, height = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden || now - last < 33) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width / 3)), h = Math.max(1, Math.round(rect.height / 3));
    if (w !== width || h !== height) {
      canvas.width = width = w; canvas.height = height = h;
      context.imageSmoothingEnabled = false;
    }
    context.clearRect(0, 0, width, height);
    const jumping = root.classList.contains('is-jumping') && !reduced.matches;
    if (!reduced.matches) phase += dt * (jumping ? 1.2 : 0.028);
    const cx = width * .5, cy = height * .43;
    for (const star of stars) {
      const depth = (star.depth + phase) % 1;
      const reach = Math.pow(depth, 2.1);
      const x = Math.round(cx + Math.cos(star.angle) * reach * width * .7);
      const y = Math.round(cy + Math.sin(star.angle) * reach * height * .72);
      context.fillStyle = depth > .7 ? '#bad7d1' : '#527987';
      context.globalAlpha = .15 + depth * .65;
      context.fillRect(x, y, star.size * (jumping && depth > .65 ? 2 : 1), jumping && depth > .65 ? 7 : star.size);
    }
    context.globalAlpha = 1;
  }
  requestAnimationFrame(frame);
} else {
  root.classList.add('no-canvas');
}

// Silent by default; only a deliberate opt-in enables a brief synthesized cue.
const sound = document.querySelector('#sound');
let enabled = false, audio;
sound.addEventListener('click', () => {
  enabled = !enabled;
  sound.setAttribute('aria-pressed', String(enabled));
  sound.textContent = enabled ? 'SOUND ON' : 'SOUND OFF';
  if (enabled) {
    try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); }
    catch { enabled = false; sound.setAttribute('aria-pressed', 'false'); sound.textContent = 'SOUND UNAVAILABLE'; }
  }
});
document.querySelector('#jump').addEventListener('click', cue);
document.querySelector('#again').addEventListener('click', cue);
function cue() {
  if (!enabled || !audio) return;
  const oscillator = audio.createOscillator(), gain = audio.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(170, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(330, audio.currentTime + .34);
  gain.gain.setValueAtTime(.0001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(.045, audio.currentTime + .04);
  gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .42);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(); oscillator.stop(audio.currentTime + .43);
}
