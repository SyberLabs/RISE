# Today's Poem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/today` view that shows one short public-domain poem per local day, under a date-seeded de Jong mandala, with **Begin this poem** opening that exact poem in the reader.

**Architecture:** A pure picker (`src/core/today-poem.js`) chooses a division from the static division index by local date. A canvas renderer (`src/components/today/mandala.js`) folds the kit's sigil twelve ways. A lazy room (`src/components/today/TodayPoem.js`) loads only the chosen work and hands the entry to `app.handleBeginSession`. Home gets one ghost link.

**Tech Stack:** Vanilla JS ES modules, Vite, Vitest + jsdom (`src/test/setup.js` stubs 2D canvas).

**Spec:** `docs/superpowers/specs/2026-10-03-poem-of-the-day-design.md`

## Global Constraints

- Works: `spoon-river-anthology`, `lyrical-ballads`; divisions of **400 words or fewer**; pool 275 today.
- Shuffle seed `rise-today-v1`; `dayNumber = Date.UTC(localY, localM, localD) / 86400000`.
- The entry must match id **and** label from `division-index.json`, else error.
- Do not edit `src/vendor/syber/*`.
- No server route, no new dependency, no emoji, sentence case copy, Atlas tokens (`--sy-*`).
- Copy: link *Read today's poem*; eyebrow *Today's poem, {date}*; key *Begin this poem*; note *A new poem, and a new mark, at midnight.*; error *Error. Today's poem could not be loaded.* with *Try again*.
- Reduced motion: mandala drawn at once, no rotation.

---

### Task 1: The daily pick

**Files:**
- Create: `src/core/today-poem.js`
- Test: `src/core/today-poem.test.js`

**Interfaces:**
- Produces: `TODAY_WORKS`, `TODAY_MAX_WORDS`, `todayPool(index?) → Array<{workId, entryId, label}>`, `localDateKey(date) → 'YYYY-MM-DD'`, `dayNumber(date) → integer`, `todayPoem(date?) → {workId, entryId, label, seed, dayNumber}`, `poemTitle(label) → string`.

- [ ] **Step 1: Write the failing test** (`src/core/today-poem.test.js`)

```js
import { describe, expect, it } from 'vitest';
import DIVISION_INDEX from '../content/archive/division-index.json' with { type: 'json' };
import { TODAY_MAX_WORDS, TODAY_WORKS, dayNumber, localDateKey, poemTitle, todayPoem, todayPool } from './today-poem.js';

describe('the pool', () => {
  it('holds every short division of the two works, once', () => {
    const pool = todayPool();
    const expected = TODAY_WORKS.flatMap(workId => DIVISION_INDEX[workId].divisionWords
      .map((words, entryId) => ({ workId, entryId, words }))
      .filter(item => item.words <= TODAY_MAX_WORDS));
    expect(pool).toHaveLength(expected.length);
    expect(pool.length).toBe(275);
    expect(new Set(pool.map(p => `${p.workId}:${p.entryId}`)).size).toBe(pool.length);
    for (const p of pool) expect(p.label).toBe(DIVISION_INDEX[p.workId].labels[p.entryId]);
    expect(pool.some(p => p.label === 'The Spooniad')).toBe(false);
  });

  it('is shuffled the same way every time, interleaving the works', () => {
    expect(todayPool()).toEqual(todayPool());
    expect(todayPool().slice(0, 40).some(p => p.workId === 'lyrical-ballads')).toBe(true);
  });
});

describe('the day', () => {
  it('counts local calendar days', () => {
    expect(localDateKey(new Date(2026, 9, 3, 23, 59))).toBe('2026-10-03');
    expect(dayNumber(new Date(2026, 9, 4, 0, 1)) - dayNumber(new Date(2026, 9, 3, 23, 59))).toBe(1);
    expect(dayNumber(new Date(2026, 9, 3, 0, 0))).toBe(dayNumber(new Date(2026, 9, 3, 23, 59)));
  });

  it('gives everyone on one local date the same poem, and the next poem tomorrow', () => {
    const pool = todayPool();
    const morning = todayPoem(new Date(2026, 9, 3, 7));
    expect(todayPoem(new Date(2026, 9, 3, 22))).toEqual(morning);
    const next = todayPoem(new Date(2026, 9, 4, 7));
    const at = p => pool.findIndex(q => q.workId === p.workId && q.entryId === p.entryId);
    expect(at(next)).toBe((at(morning) + 1) % pool.length);
    expect(morning.seed).toBe('2026-10-03');
  });

  it('repeats no poem within one cycle', () => {
    const seen = new Set();
    for (let i = 0; i < todayPool().length; i++) {
      const p = todayPoem(new Date(2026, 0, 1 + i, 12));
      seen.add(`${p.workId}:${p.entryId}`);
    }
    expect(seen.size).toBe(todayPool().length);
  });
});

describe('poemTitle', () => {
  it('drops the volume prefix of Lyrical Ballads', () => {
    expect(poemTitle('Volume II · Lucy Gray')).toBe('Lucy Gray');
    expect(poemTitle('Anne Rutledge')).toBe('Anne Rutledge');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/core/today-poem.test.js`
Expected: FAIL, cannot resolve `./today-poem.js`.

- [ ] **Step 3: Implement** (`src/core/today-poem.js`)

```js
/**
 * Today's poem: one short poem per local calendar day, the same for every
 * reader on that date. Pure; reads the static division index, never text.
 */
import DIVISION_INDEX from '../content/archive/division-index.json' with { type: 'json' };

export const TODAY_WORKS = Object.freeze(['spoon-river-anthology', 'lyrical-ballads']);
export const TODAY_MAX_WORDS = 400;
const SHUFFLE_SEED = 'rise-today-v1';

function hash(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}

function random(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function todayPool(index = DIVISION_INDEX) {
  const pool = [];
  for (const workId of TODAY_WORKS) {
    const work = index[workId];
    work?.labels.forEach((label, entryId) => {
      if (work.divisionWords[entryId] <= TODAY_MAX_WORDS) pool.push({ workId, entryId, label });
    });
  }
  const next = random(hash(SHUFFLE_SEED));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

const pad = n => String(n).padStart(2, '0');
export const localDateKey = date =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const dayNumber = date =>
  Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;

let pool = null;
export function todayPoem(date = new Date()) {
  pool ??= todayPool();
  const day = dayNumber(date);
  return { ...pool[((day % pool.length) + pool.length) % pool.length], seed: localDateKey(date), dayNumber: day };
}

export const poemTitle = label => String(label).replace(/^Volume [IVX]+ · /u, '');
```

- [ ] **Step 4: Run it to see it pass** — `npx vitest run src/core/today-poem.test.js` → PASS.
- [ ] **Step 5: Commit** — `git add src/core/today-poem.js src/core/today-poem.test.js && git commit -m "Pick today's poem by local date from the short verse divisions"`

---

### Task 2: The mandala

**Files:**
- Create: `src/components/today/mandala.js`
- Test: `src/components/today/mandala.test.js`

**Interfaces:**
- Consumes: `params(name)` from `src/vendor/syber/syber-sigil.js` → `{ P, box: [cx, cy, size], caption }`.
- Produces: `foldMatrices(folds) → Array<{c, s, m}>` (m is 1 or −1), `drawMandala(canvas, seed, { folds = 12, animate = true }) → { caption, cancel() } | null`.

- [ ] **Step 1: Write the failing test** (`src/components/today/mandala.test.js`)

```js
import { afterEach, describe, expect, it, vi } from 'vitest';
import { params } from '../../vendor/syber/syber-sigil.js';
import { drawMandala, foldMatrices } from './mandala.js';

const apply = ({ c, s, m }, x, y) => [m * x * c - y * s, m * x * s + y * c];

describe('foldMatrices', () => {
  it('turns by equal steps and mirrors every other fold', () => {
    const folds = foldMatrices(4);
    expect(folds).toHaveLength(4);
    const [x0, y0] = apply(folds[0], 1, 0);
    const [x1, y1] = apply(folds[1], 1, 0);
    expect([x0, y0].map(v => +v.toFixed(6))).toEqual([1, 0]);
    expect([x1, y1].map(v => +v.toFixed(6))).toEqual([-0, -1]);
    expect(folds.map(f => f.m)).toEqual([1, -1, 1, -1]);
  });
});

describe('drawMandala', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('draws once, at once, under reduced motion and names the seed', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const raf = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf);
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { value: 64 });
    const result = drawMandala(canvas, '2026-10-03', { folds: 6 });
    const ctx = canvas.getContext('2d');
    expect(ctx.putImageData).toHaveBeenCalledTimes(1);
    expect(raf).not.toHaveBeenCalled();
    expect(result.caption).toBe(params('2026-10-03').caption);
    expect(canvas.width).toBeGreaterThan(0);
  });

  it('returns null without a 2D canvas', () => {
    const canvas = { clientWidth: 10, getContext: () => null };
    expect(drawMandala(canvas, 'x')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to see it fail** — `npx vitest run src/components/today/mandala.test.js` → FAIL, module missing.

- [ ] **Step 3: Implement** (`src/components/today/mandala.js`)

```js
/**
 * Today's mark: the kit's de Jong sigil for a date, folded `folds` ways
 * about its centre (odd folds mirrored), one Atlas spectrum colour per fold,
 * added on ink with log density so dense cores burn toward white.
 * The kit itself is not edited; only its seeding (`params`) is used.
 */
import { params } from '../../vendor/syber/syber-sigil.js';

// ice, blue, violet, magenta, amber, accent-rise
const COLORS = [[144, 216, 240], [72, 144, 240], [154, 107, 255], [255, 88, 214], [255, 181, 74], [242, 217, 166]];

export function foldMatrices(folds) {
  return Array.from({ length: folds }, (_, k) => {
    const a = (2 * Math.PI * k) / folds;
    return { c: Math.cos(a), s: Math.sin(a), m: k % 2 ? -1 : 1 };
  });
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function drawMandala(canvas, seed, { folds = 12, animate = true } = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { P, box, caption } = params(seed);
  const S = Math.round(canvas.clientWidth * Math.min(globalThis.devicePixelRatio || 1, 2)) || 480;
  canvas.width = canvas.height = S;
  const img = ctx.createImageData(S, S);
  const hist = COLORS.map(() => new Float32Array(S * S));
  const turns = foldMatrices(folds);
  const k = (S * 0.68) / box[2];
  const half = S / 2;
  const TOTAL = Math.round(S * S * 0.4);
  const STEP = animate && !reducedMotion() ? Math.ceil(TOTAL / 16) : TOTAL;
  let x = 0.1, y = 0.1, done = 0, max = 1, raf = 0;

  const paint = () => {
    const d = img.data, L = Math.log(1 + max * 0.5);
    for (let j = 0; j < S * S; j++) {
      let r = 0, g = 0, b = 0, dense = 0;
      for (let c = 0; c < COLORS.length; c++) {
        const v = hist[c][j];
        if (!v) continue;
        const t = Math.min(1, Math.log(1 + v) / L);
        r += COLORS[c][0] * t; g += COLORS[c][1] * t; b += COLORS[c][2] * t;
        if (t > dense) dense = t;
      }
      if (!dense) continue;
      const w = dense * dense * dense * 0.9, q = j * 4;
      r = Math.min(255, r); g = Math.min(255, g); b = Math.min(255, b);
      d[q] = r + (255 - r) * w; d[q + 1] = g + (255 - g) * w; d[q + 2] = b + (255 - b) * w;
      d[q + 3] = 255 * Math.min(1, 1.25 * Math.pow(dense, 0.6));
    }
    ctx.putImageData(img, 0, 0);
  };

  const chunk = () => {
    raf = 0;
    for (let i = 0; i < STEP && done < TOTAL; i++, done++) {
      const nx = Math.sin(P[0] * y) - Math.cos(P[1] * x);
      y = Math.sin(P[2] * x) - Math.cos(P[3] * y);
      x = nx;
      const rx = (x - box[0]) * k, ry = (y - box[1]) * k;
      for (let f = 0; f < turns.length; f++) {
        const { c, s, m } = turns[f];
        const ix = (half + m * rx * c - ry * s) | 0, iy = (half + m * rx * s + ry * c) | 0;
        if (ix < 0 || iy < 0 || ix >= S || iy >= S) continue;
        const h = hist[f % COLORS.length], j = ix + iy * S;
        if (++h[j] > max) max = h[j];
      }
    }
    paint();
    if (done < TOTAL) raf = requestAnimationFrame(chunk);
  };
  chunk();
  return { caption, cancel() { if (raf) cancelAnimationFrame(raf); raf = 0; } };
}
```

- [ ] **Step 4: Run it to see it pass** — `npx vitest run src/components/today/mandala.test.js` → PASS.
- [ ] **Step 5: Commit** — `git add src/components/today/mandala.* && git commit -m "Fold the date's sigil into a twelve-way mandala"`

---

### Task 3: The Today view

**Files:**
- Create: `src/components/today/TodayPoem.js`, `src/components/today/today-poem.css`
- Test: `src/components/today/TodayPoem.test.js`

**Interfaces:**
- Consumes: Task 1 `todayPoem`, `poemTitle`, `localDateKey`; Task 2 `drawMandala`; `releaseArchiveTexts()` from `src/content/archive/index.js` (records `{ id, title, author, editionId, sourceRevision, defaultWpm, defaultCurve, getDivisions() }`); `escapeHtml` from `src/core/sanitize.js`.
- Produces: `class TodayPoem(container, { onNavigate, onBegin })` with `activate()`, `deactivate()`, `destroy()`. `onBegin(sessionConfig) → Promise<boolean>`.

- [ ] **Step 1: Write the failing test** (`src/components/today/TodayPoem.test.js`)

```js
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const entries = [{ id: 0, label: 'The Hill', verse: true, content: 'x' }];
const work = {
  id: 'spoon-river-anthology', title: 'Spoon River Anthology', author: 'Edgar Lee Masters',
  editionId: 'ed', sourceRevision: 'rev', defaultWpm: 200, defaultCurve: 'flat',
  getDivisions: vi.fn()
};
vi.mock('../../content/archive/index.js', () => ({ releaseArchiveTexts: () => [work] }));
vi.mock('../../core/today-poem.js', async importOriginal => ({
  ...await importOriginal(),
  todayPoem: () => ({ workId: 'spoon-river-anthology', entryId: 1, label: 'Anne Rutledge', seed: '2026-10-03', dayNumber: 1 })
}));
vi.mock('./mandala.js', () => ({ drawMandala: vi.fn(() => ({ caption: 'a 1 · b 2 · c 3 · d 4', cancel: vi.fn() })) }));

import { TodayPoem } from './TodayPoem.js';

const anne = { id: 1, label: 'Anne Rutledge', verse: true, content: 'Out of me unworthy and unknown\nThe vibrations of deathless music;' };
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('TodayPoem', () => {
  let container;
  beforeEach(() => { container = document.createElement('div'); document.body.append(container); });
  afterEach(() => { container.remove(); vi.clearAllMocks(); });

  it('shows today\'s poem with its lines, then begins exactly that division', async () => {
    work.getDivisions.mockResolvedValue({ entries: [entries[0], anne] });
    const onBegin = vi.fn(async () => true);
    const view = new TodayPoem(container, { onBegin });
    view.activate();
    expect(container.querySelector('#today-title').textContent).toBe('Anne Rutledge');
    expect(container.querySelector('[data-begin]').disabled).toBe(true);
    await flush();
    const lines = [...container.querySelectorAll('.today-line')].map(n => n.textContent);
    expect(lines).toEqual(['Out of me unworthy and unknown', 'The vibrations of deathless music;']);
    expect(container.querySelector('[data-caption]').textContent).toContain('Seed 2026-10-03');
    container.querySelector('[data-begin]').click();
    await flush();
    expect(onBegin).toHaveBeenCalledWith(expect.objectContaining({
      text: anne.content,
      textSource: 'Spoon River Anthology · Anne Rutledge',
      verseLines: true,
      origin: { view: 'today', name: 'Today\'s poem' },
      continuation: expect.objectContaining({ kind: 'library-division', workId: 'spoon-river-anthology', entryId: '1', entryIndex: 1, entryCount: 2 })
    }));
    view.destroy();
  });

  it('refuses a division whose label changed, and Try again recovers', async () => {
    work.getDivisions.mockResolvedValueOnce({ entries: [entries[0], { ...anne, label: 'Someone else' }] });
    const view = new TodayPoem(container, {});
    await flush();
    expect(container.querySelector('[role="alert"]').textContent).toContain('Today\'s poem could not be loaded.');
    expect(container.querySelector('[data-begin]').disabled).toBe(true);
    work.getDivisions.mockResolvedValueOnce({ entries: [entries[0], anne] });
    container.querySelector('[data-retry]').click();
    await flush();
    expect(container.querySelectorAll('.today-line')).toHaveLength(2);
    view.destroy();
  });

  it('returns Home from its back control', () => {
    work.getDivisions.mockResolvedValue({ entries: [entries[0], anne] });
    const onNavigate = vi.fn();
    const view = new TodayPoem(container, { onNavigate });
    container.querySelector('[data-nav="portal"]').click();
    expect(onNavigate).toHaveBeenCalledWith('portal');
    view.destroy();
  });
});
```

- [ ] **Step 2: Run it to see it fail** — `npx vitest run src/components/today/TodayPoem.test.js` → FAIL, module missing.

- [ ] **Step 3: Implement** (`src/components/today/TodayPoem.js`)

```js
/**
 * The Today view: one poem per local day under a mandala drawn from the
 * date. Loads only the chosen work and checks the division's label against
 * the index, so a changed edition is an error rather than a different poem.
 */
import { releaseArchiveTexts } from '../../content/archive/index.js';
import { escapeHtml } from '../../core/sanitize.js';
import { localDateKey, poemTitle, todayPoem } from '../../core/today-poem.js';
import { drawMandala } from './mandala.js';
import './today-poem.css';

const FOLDS = 12;
const BACK_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"></path><path d="m11 18-6-6 6-6"></path></svg>';
const SKELETON = '<span class="today-skeleton"></span>'.repeat(6);

export class TodayPoem {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => {});
    this.onBegin = options.onBegin || (async () => false);
    this._ticket = 0;
    this.show(new Date());
  }

  show(date) {
    this._events?.abort();
    this._mark?.cancel();
    this._mark = null;
    this._events = new AbortController();
    this.date = date;
    this.pick = todayPoem(date);
    this.work = releaseArchiveTexts().find(item => item.id === this.pick.workId) || null;
    this.entry = null;
    this.render();
    this.attachEvents();
    void this.load();
  }

  render() {
    const day = this.date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    const byline = this.work ? `${this.work.author}, from ${this.work.title}` : '';
    this.container.innerHTML = `
      <main class="today" id="main-content" aria-labelledby="today-title">
        <button type="button" class="today-back" data-nav="portal" aria-label="Return to Home">${BACK_ICON} Home</button>
        <p class="today-eyebrow">Today's poem, ${escapeHtml(day)}</p>
        <figure class="today-mark">
          <canvas class="today-mandala" aria-hidden="true"></canvas>
          <figcaption class="today-caption" data-caption>Seed ${escapeHtml(this.pick.seed)}</figcaption>
        </figure>
        <header class="today-head">
          <h1 class="today-title" id="today-title">${escapeHtml(poemTitle(this.pick.label))}</h1>
          <p class="today-byline">${escapeHtml(byline)}</p>
        </header>
        <div class="today-plate sy-plate"><div class="today-poem" data-poem aria-busy="true">${SKELETON}</div></div>
        <div class="today-actions">
          <button type="button" class="btn btn-primary" data-begin disabled>Begin this poem</button>
          <p class="today-note">A new poem, and a new mark, at midnight.</p>
        </div>
      </main>`;
  }

  attachEvents() {
    const signal = this._events.signal;
    this.container.querySelector('[data-nav="portal"]').addEventListener('click', () => this.onNavigate('portal'), { signal });
    this.container.querySelector('[data-begin]').addEventListener('click', () => void this.begin(), { signal });
    this.container.addEventListener('click', event => {
      if (event.target.closest('[data-retry]')) void this.load();
    }, { signal });
  }

  async load() {
    const ticket = ++this._ticket;
    const { entryId, label } = this.pick;
    this.setPoem('loading');
    try {
      if (!this.work) throw new Error('The work is not released.');
      const divisions = await this.work.getDivisions();
      const entryIndex = divisions.entries.findIndex(entry => String(entry.id) === String(entryId));
      const entry = divisions.entries[entryIndex];
      if (!entry || entry.label !== label) throw new Error('The division changed.');
      if (ticket !== this._ticket) return;
      Object.assign(this, { entry, entryIndex, divisions });
      this.setPoem('ready');
    } catch {
      if (ticket === this._ticket) this.setPoem('error');
    }
  }

  setPoem(state) {
    const poem = this.container.querySelector('[data-poem]');
    const begin = this.container.querySelector('[data-begin]');
    if (!poem || !begin) return;
    poem.setAttribute('aria-busy', String(state === 'loading'));
    begin.disabled = state !== 'ready';
    if (state === 'loading') poem.innerHTML = SKELETON;
    else if (state === 'error') {
      poem.innerHTML = `<div class="sy-alert sy-alert--danger today-error" role="alert">
        <p>Error. Today's poem could not be loaded.</p>
        <button type="button" class="btn btn-secondary" data-retry>Try again</button></div>`;
    } else {
      poem.innerHTML = this.entry.content.split('\n')
        .map(line => line.trim() ? `<span class="today-line">${escapeHtml(line)}</span>` : '<span class="today-gap"></span>')
        .join('');
    }
  }

  async begin() {
    const { work, entry, entryIndex, divisions } = this;
    const button = this.container.querySelector('[data-begin]');
    if (!entry || !button || button.disabled) return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    const opened = await this.onBegin({
      text: entry.content,
      textSource: `${work.title} · ${poemTitle(entry.label)}`,
      wpm: work.defaultWpm,
      curve: work.defaultCurve,
      verseLines: entry.verse === true,
      continuation: {
        kind: 'library-division',
        workId: work.id,
        editionId: work.editionId,
        sourceRevision: work.sourceRevision,
        entryId: String(entry.id),
        entryIndex,
        entryCount: divisions.entries.length,
        noun: 'poem'
      },
      origin: { view: 'today', name: 'Today\'s poem' }
    });
    if (!opened && button.isConnected) {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  activate() {
    const now = new Date();
    if (localDateKey(now) !== this.pick.seed) this.show(now);
    if (this._mark) return;
    const canvas = this.container.querySelector('.today-mandala');
    this._mark = canvas && drawMandala(canvas, this.pick.seed, { folds: FOLDS });
    const caption = this.container.querySelector('[data-caption]');
    if (this._mark && caption) caption.textContent = `Seed ${this.pick.seed} · ${this._mark.caption} · ${FOLDS} folds`;
  }

  deactivate() {}

  destroy() {
    this._ticket++;
    this._events?.abort();
    this._mark?.cancel();
    this.container.innerHTML = '';
  }
}
```

Note on the test's mandala mock: `activate()` draws, so the first test calls `view.activate()` before reading the caption.

**As built:** the view uses the shared room frame from `src/components/room-chrome.js` (`roomHeader`, `roomEyebrow`, `roomAlert`) instead of its own back button and alert, so the back control is `[data-action="back"]` and the header carries the SyberLabs / RISE lockup like the other quiet rooms.

- [ ] **Step 4: Write the styles** (`src/components/today/today-poem.css`)

```css
.today {
  --sy-plate-tick: var(--sy-accent-rise);
  min-height: 100svh;
  box-sizing: border-box;
  max-width: 960px;
  margin: 0 auto;
  padding: var(--sy-space-7) clamp(16px, 4vw, 56px) var(--sy-space-9);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sy-space-6);
  text-align: center;
  color: var(--sy-text-body);
  font-family: var(--sy-font-sans);
}
.today-back {
  align-self: flex-start;
  display: inline-flex; align-items: center; gap: var(--sy-space-2);
  min-height: 44px; padding: 0 var(--sy-space-3);
  background: none; border: 0; color: var(--sy-text-2); font: inherit; cursor: pointer;
}
.today-back:hover { color: var(--sy-text); }
.today-eyebrow, .today-caption {
  margin: 0; font-family: var(--sy-font-mono); font-size: 12px; color: var(--sy-text-2);
}
.today-eyebrow { font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; }
.today-caption { line-height: 1.6; }
.today-mark { margin: 0; width: min(100%, 600px); display: flex; flex-direction: column; align-items: center; gap: var(--sy-space-4); }
.today-mandala {
  width: 100%; aspect-ratio: 1 / 1; display: block;
  background: radial-gradient(circle at 50% 50%, #9a6bff2e 0, #0048f01f 40%, transparent 70%);
  animation: today-turn 240s linear infinite;
}
@keyframes today-turn { to { transform: rotate(360deg); } }
.today-head { display: flex; flex-direction: column; align-items: center; gap: var(--sy-space-3); }
.today-title {
  margin: 0; font-family: var(--sy-font-serif); font-weight: 400;
  font-size: clamp(48px, 6.4vw, 88px); line-height: 0.95; letter-spacing: -0.02em; color: var(--sy-text);
}
.today-byline, .today-note { margin: 0; font-size: 15px; line-height: 22px; color: var(--sy-text-2); }
.today-note { font-size: 14px; line-height: 20px; }
.today-plate { padding: var(--sy-space-7) clamp(20px, 5vw, 56px); text-align: left; max-width: 100%; box-sizing: border-box; }
.today-poem {
  display: flex; flex-direction: column;
  font-family: var(--sy-font-reading); font-size: clamp(18px, 1.6vw, 22px); line-height: 1.6; color: var(--sy-text-body);
}
.today-line { padding-left: 1em; text-indent: -1em; }
.today-gap { height: 0.8em; }
.today-skeleton { display: block; height: 1em; margin: 0.3em 0; width: 22ch; max-width: 100%; background: var(--sy-surface-2); }
.today-actions { display: flex; flex-direction: column; align-items: center; gap: var(--sy-space-3); }
@media (prefers-reduced-motion: reduce) {
  .today-mandala { animation: none; }
}
```

- [ ] **Step 5: Run the test** — `npx vitest run src/components/today/TodayPoem.test.js` → PASS.
- [ ] **Step 6: Commit** — `git add src/components/today && git commit -m "Add the Today view: the poem, its mark and Begin"`

---

### Task 4: Route, path and return

**Files:**
- Modify: `src/app/route-manifest.js` (append a `today` route after `chapel`), `src/app/route-manifest.test.js` (`ROUTE_IDS` gains `'today'` last)
- Modify: `index.html` (add `<div id="view-today" class="view-container" hidden></div>` after `view-keystones`)
- Modify: `src/app.js` (`TODAY_PATH = '/today'`, `PUBLIC_ROOM_PATHS.today`, start-up `else if (window.location.pathname === TODAY_PATH) await this.router.navigate('today');` beside `EMOTIONS_PATH`)
- Modify: `src/app/chamber-exit.js`, `src/app/chamber-exit.test.js`

**Interfaces:**
- Consumes: Task 3 `TodayPoem`; `operations.handleBeginSession` (already passed to the manifest).

- [ ] **Step 1: Failing tests.** In `route-manifest.test.js` append `'today'` to `ROUTE_IDS`. In `chamber-exit.test.js`, inside `describe('every other surface leaves exactly as it did')`, add:

```js
    it('returns a reading opened from today\'s poem to that poem', () => {
        for (const reason of LEAVING) {
            expect(chamberExitTarget(reason, { origin: { view: 'today', name: 'Today\'s poem' } }), reason)
                .toEqual({ kind: 'navigate', view: 'today' });
        }
    });
```

- [ ] **Step 2: Run** — `npx vitest run src/app/route-manifest.test.js src/app/chamber-exit.test.js` → both FAIL.

- [ ] **Step 3: Implement.** Route (last entry of the array in `route-manifest.js`):

```js
    {
      id: 'today',
      containerId: 'view-today',
      load: () => import('../components/today/TodayPoem.js'),
      create: (container, _data, { TodayPoem }) => new TodayPoem(container, {
        onNavigate: operations.handleNavigate,
        onBegin: operations.handleBeginSession
      })
    }
```

`chamber-exit.js`, directly after the live line:

```js
    // Today's poem returns to the poem, where tomorrow's waits at midnight.
    if (session?.origin?.view === 'today') return { kind: 'navigate', view: 'today' };
```

`app.js`: add `const TODAY_PATH = '/today';` beside `EMOTIONS_PATH`, `today: TODAY_PATH` in `PUBLIC_ROOM_PATHS`, and the start-up branch after the `EMOTIONS_PATH` branch. Add the `view-today` container to `index.html`.

- [ ] **Step 4: Run** — same command → PASS. Also `npx vitest run src/app.*.test.js src/app/` → PASS.
- [ ] **Step 5: Commit** — `git commit -am "Route /today to the Today view and return readings there"` (add `index.html`).

---

### Task 5: Home's link

**Files:**
- Modify: `src/components/Portal.js` (`idleView()` and the `#home-form` click handler)
- Test: `src/components/Portal.test.js`

- [ ] **Step 1: Failing test** (add to `Portal.test.js`, following its existing construction helper):

```js
  it('offers today\'s poem from the idle panel and opens it', () => {
    const onNavigate = vi.fn();
    const portal = makePortal({ onNavigate }); // the file's existing helper
    const link = portal.container.querySelector('[data-home="today"]');
    expect(link.textContent).toBe('Read today\'s poem');
    expect(link.className).toContain('btn-ghost');
    link.click();
    expect(onNavigate).toHaveBeenCalledWith('today');
  });
```

(Use whatever construction helper `Portal.test.js` already has; if none, construct `new Portal(container, { onNavigate })` as its other tests do.)

- [ ] **Step 2: Run** — `npx vitest run src/components/Portal.test.js` → the new test FAILS.
- [ ] **Step 3: Implement.** In `idleView()` after the `home-actions` div: `<p class="home-today">${button('today', 'Read today’s poem', 'ghost')}</p>` — use a plain apostrophe to match the test: `'Read today\'s poem'`. In the `#home-form` click handler add `else if (action === 'today') this.onNavigate('today');`.
- [ ] **Step 4: Run** — `npx vitest run src/components/Portal.test.js src/components/Portal.jev.test.js` → PASS.
- [ ] **Step 5: Commit** — `git commit -am "Link today's poem from Home's idle panel"`

---

### Task 6: Docs, full checks, pull request

- [ ] `npm run docs:diagram`; commit `docs/specs/ARCHITECTURE.md` if it changed.
- [ ] `npx vitest run src/core/system-design.test.js` → PASS.
- [ ] `npm run test:run` → PASS (needs `npm run audio:hydrate` first if recitation tests fail for missing WAVs).
- [ ] `npx vite build && npm run measure:first-load` → within budget (the view is lazy).
- [ ] `npm run test:e2e:gate` → PASS.
- [ ] Run the app (`npm run dev`), open `/today` and Home in Chrome; screenshot desktop and 390px; check reduced motion.
- [ ] Mark the spec **as built**, push `poem-of-the-day`, open a PR against `main`.
