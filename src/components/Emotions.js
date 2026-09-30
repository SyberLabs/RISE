/**
 * RISE EMOTIONS — the map.
 *
 * Texts that carry valence and arousal sit in the plane. Colors and
 * Living Flame scenes that carry warmth sit on the spectral ring.
 * Hue follows warmth. The Thomas filament is the wheel in motion.
 * The chamber does not import this room.
 */

import { CORPUS } from '../affect/benchmark/corpus.js';
import { placeEmotion, swatchWarmth, thomasFilament } from '../affect/emotion-map.js';
import { encodeText } from '../affect/text/encode.js';
import { escapeHtml } from '../core/sanitize.js';
import { ATTRACTOR_PALETTES } from '../core/visual-style-definitions.js';
import { FLAME_PRESETS } from '../visuals/living-flame/flame-presets.js';
import { roomEyebrow, roomHeader } from './room-chrome.js';
import './Emotions.css';

const KIND_LABEL = Object.freeze({
    text: 'Text',
    color: 'Color',
    visual: 'Visual'
});

function axis(state, id) {
    const value = state?.dimensions?.[id]?.value;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function meanWarmth(colors) {
    const values = colors.map(swatchWarmth).filter(value => value != null);
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function inhabit(record) {
    const place = placeEmotion(record);
    return place ? { ...record, place } : null;
}

export function emotionInhabitants() {
    const texts = CORPUS.map(item => {
        const state = encodeText(item.text);
        return inhabit({
            id: item.id,
            kind: 'text',
            label: item.provenance.work,
            detail: item.provenance.author,
            valence: axis(state, 'valence'),
            arousal: axis(state, 'arousal'),
            warmth: axis(state, 'warmth')
        });
    });
    const colors = ATTRACTOR_PALETTES.map(palette => inhabit({
        id: `color-${palette.id}`,
        kind: 'color',
        label: palette.name,
        detail: 'Attractor',
        valence: null,
        arousal: null,
        warmth: swatchWarmth(palette.swatch)
    }));
    const visuals = FLAME_PRESETS.map(preset => inhabit({
        id: `visual-${preset.id}`,
        kind: 'visual',
        label: preset.name,
        detail: 'Living Flame',
        valence: null,
        arousal: preset.macros.energy,
        warmth: meanWarmth(preset.palette)
    }));
    return [...texts, ...colors, ...visuals].filter(Boolean);
}

function figure(value) {
    return value == null ? 'absent' : value.toFixed(2);
}

export class Emotions {
    constructor(container, options = {}) {
        this.container = container;
        this.onNavigate = options.onNavigate || (() => {});
        this.inhabitants = emotionInhabitants();
        this.filament = thomasFilament();
        this.selected = null;
        this._frame = 0;
        this.render();
        this._onClick = event => this.onClick(event);
        this.container.addEventListener('click', this._onClick);
        this.canvas = this.container.querySelector('canvas.emotions-field');
        this.started = 0;
        const loop = now => {
            if (this.started === 0) this.started = now;
            this.draw((now - this.started) / 1000);
            this._frame = requestAnimationFrame(loop);
        };
        if (typeof requestAnimationFrame === 'function') this._frame = requestAnimationFrame(loop);
        else this.draw(0);
    }

    render() {
        const items = this.inhabitants.map(item => `
            <li>
              <button type="button" class="emotions-item" data-id="${escapeHtml(item.id)}" data-kind="${item.kind}">
                <span class="emotions-kind">${KIND_LABEL[item.kind]}</span>
                <span class="emotions-label">${escapeHtml(item.label)}</span>
                <span class="emotions-meta">${escapeHtml(item.detail)} · valence ${figure(item.valence)} · arousal ${figure(item.arousal)} · warmth ${figure(item.warmth)}</span>
              </button>
            </li>
        `).join('');
        this.container.innerHTML = `
          <main class="emotions" aria-label="RISE EMOTIONS">
            ${roomHeader({ back: 'Home' })}
            <div class="emotions-body">
              <canvas class="emotions-field" aria-hidden="true"></canvas>
              <section class="emotions-copy">
                ${roomEyebrow('AFFECT')}
                <h1>RISE EMOTIONS</h1>
                <p class="emotions-law">Hue follows warmth. A missing axis stays absent.</p>
                <ul class="emotions-list">${items}</ul>
              </section>
            </div>
          </main>
        `;
    }

    onClick(event) {
        if (event.target.closest('[data-action="back"]')) {
            this.onNavigate('portal');
            return;
        }
        const button = event.target.closest('.emotions-item');
        if (!button) return;
        this.selected = button.dataset.id;
        for (const item of this.container.querySelectorAll('.emotions-item')) {
            if (item === button) item.setAttribute('aria-current', 'true');
            else item.removeAttribute('aria-current');
        }
    }

    draw(seconds) {
        const canvas = this.canvas;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 800;
        const height = canvas.clientHeight || canvas.parentElement?.clientHeight || 600;
        const dpr = globalThis.devicePixelRatio || 1;
        const pixelWidth = Math.max(1, Math.round(width * dpr));
        const pixelHeight = Math.max(1, Math.round(height * dpr));
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        const radius = Math.min(width, height) * 0.36;
        ctx.save();
        ctx.translate(width * 0.42, height * 0.5);
        ctx.scale(radius, radius);
        ctx.lineWidth = 1.2 / radius;
        ctx.strokeStyle = 'rgba(255,255,255,0.16)';
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.moveTo(-1, 0);
        ctx.lineTo(1, 0);
        ctx.moveTo(0, -1);
        ctx.lineTo(0, 1);
        ctx.stroke();

        ctx.save();
        ctx.rotate(seconds * 0.12);
        ctx.lineCap = 'round';
        for (let i = 1; i < this.filament.length; i++) {
            const from = this.filament[i - 1];
            const to = this.filament[i];
            ctx.strokeStyle = `hsla(${to.hue}, 78%, 64%, 0.42)`;
            ctx.beginPath();
            ctx.moveTo(from.x, -from.y);
            ctx.lineTo(to.x, -to.y);
            ctx.stroke();
        }
        ctx.restore();

        for (const item of this.inhabitants) {
            const selected = item.id === this.selected;
            ctx.beginPath();
            ctx.fillStyle = item.place.hue == null
                ? 'rgba(244, 241, 232, 0.9)'
                : `hsl(${item.place.hue}, 72%, ${selected ? 74 : 58}%)`;
            ctx.arc(item.place.x, -item.place.y, selected ? 0.05 : 0.03, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    destroy() {
        if (this._frame) cancelAnimationFrame(this._frame);
        this._frame = 0;
        this.container.removeEventListener('click', this._onClick);
    }
}
