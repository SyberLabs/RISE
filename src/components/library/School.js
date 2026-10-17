/**
 * The Mystery School: the graded canon as a wheel, and a lectern that reads
 * whatever the wheel points at.
 *
 * The Wheel is SVG for what is drawn (sectors, rings, the Gate disc, a path's
 * line) and real buttons for what is pressed (every text, every house, the
 * Gate), placed in percent from one geometry module. The Lectern lists
 * everything the Wheel shows, so the picture is never the only road.
 *
 * A text's state is resolved from the content manifest and the reader's
 * record on this device; nothing here is hand-written per text. Its ink:
 * absent a hollow ring, carried a dashed ring, readable a solid ring, begun a
 * solid ring with a centre dot, read a filled disc, arcanum a filled disc
 * with a halo.
 *
 * At PHONE width the text points are ink only (no pointer, no tab stop,
 * hidden from assistive technology): 0.10 of the radius is under 15 px there,
 * so a press would land on a neighbour. The Gate and the houses stay
 * pressable, and the Lectern lists every text.
 */

import { getTextById } from '../../content/library.js';
import { SCHOOL_CANON } from '../../content/school/canon.js';
import { schoolWorkById } from '../../content/school/corpus.js';
import { DEGREES, GATE, HOUSES } from '../../content/school/houses.js';
import {
  GATE_RADIUS,
  RING_RADIUS,
  WHEEL_SECTOR_DEGREES,
  corpusDivisions,
  houseById,
  pathsOfRecord,
  recordById,
  recordsOfHouse,
  schoolStatus,
  wheelPosition
} from '../../content/school/index.js';
import { SCHOOL_PATHS } from '../../content/school/paths.js';
import { contentStore } from '../../core/content-store.js';
import { JEV_PALETTES } from '../../core/jev-palette.js';
import { escapeHtml } from '../../core/sanitize.js';
import { holdsArcanum, houseSeals, readProgress, readState } from '../../core/school-progress.js';
import { roomEyebrow, roomHeader, roomIcon } from '../room-chrome.js';
import './School.css';

/** Half the wheel's box in wheel units: the circle is radius 1, the house names ride outside it. */
const VIEW = 1.22;
/** The house names sit just outside the circle, glyph over name, so the widest stays inside the wheel's box. */
const RIM_LABEL_RADIUS = 1.07;
/** Nearer the rim on a phone, so a 44 px house button stays inside the wheel's box. */
const RIM_LABEL_RADIUS_PHONE = 1.05;
const STACKED = '(max-width: 820px)';
const PHONE = '(max-width: 480px)';

const RIGHTS = Object.freeze({
  'us-pd': 'Public domain',
  'us-only': 'Public domain in the US',
  'orig-only': 'Original language only'
});

const STATE_WORDS = Object.freeze({
  absent: 'Not yet carried',
  carried: 'Carried, not served',
  readable: 'Readable in RISE',
  begun: 'Begun',
  read: 'Read',
  arcanum: 'Read'
});

const CHARTER = [
  'The Mystery School is a free, graded course in public-domain texts on consciousness, technology, culture and spirit, read in RISE. Each text is here because it opened a door that is still open.',
  'Everyone enters through the Gate. The seven houses can be taken in any order; inside each, a reader climbs from Threshold to Core to Arcanum, the lesser rites before the greater, as the old mysteries taught.',
  'Every text can be copied, re-presented and handed on without permission or fee. What RISE cannot serve yet is still listed here, with the reason and a free edition outside RISE.'
];

const percent = value => `${((value + VIEW) / (2 * VIEW) * 100).toFixed(3)}%`;
const hue = house => JEV_PALETTES[house?.theme]?.accent || null;
const hueStyle = house => (hue(house) ? `--school-hue: ${hue(house)};` : '');
const degreeName = n => DEGREES.find(degree => degree.n === n)?.name || '';
const pathById = id => SCHOOL_PATHS.find(path => path.id === id) || null;

function polar(radius, degrees) {
  const theta = degrees * Math.PI / 180;
  return [radius * Math.sin(theta), -radius * Math.cos(theta)];
}

function sectorPath(order) {
  const from = order * WHEEL_SECTOR_DEGREES;
  const to = from + WHEEL_SECTOR_DEGREES;
  const [ax, ay] = polar(1, from);
  const [bx, by] = polar(1, to);
  const [cx, cy] = polar(GATE_RADIUS, to);
  const [dx, dy] = polar(GATE_RADIUS, from);
  return `M${ax} ${ay}A1 1 0 0 1 ${bx} ${by}L${cx} ${cy}A${GATE_RADIUS} ${GATE_RADIUS} 0 0 0 ${dx} ${dy}Z`;
}

/** A focus from an address segment; anything unknown is the Gate. */
function parseFocus(value) {
  if (typeof value === 'string' && value.startsWith('path-') && pathById(value.slice(5))) {
    return { kind: 'path', id: value.slice(5) };
  }
  if (value !== GATE.id && HOUSES.some(house => house.id === value)) return { kind: 'house', id: value };
  if (recordById(value)) return { kind: 'record', id: value };
  return { kind: 'gate', id: GATE.id };
}

function focusKey(focus) {
  return focus.kind === 'path' ? `path-${focus.id}` : focus.id;
}

/** A corpus work states its life+70 status; any other record its plan rights. */
function rightsLine(record) {
  const life70 = record.work?.corpus ? schoolWorkById(record.id)?.rights.life70 : null;
  if (!life70) return RIGHTS[record.rights];
  if (life70 === 'pd') return 'Public domain';
  if (life70 === 'unknown') return 'Public domain in the US; translator’s dates unknown';
  return `Public domain in the US; in copyright in life+70 countries until ${life70.slice('until:'.length)}`;
}

const LANGUAGES = Object.freeze({ la: 'Latin', fr: 'French', de: 'German' });

/**
 * A corpus work not in English says so after its state, as does one served in
 * RISE's own translation; an English one says nothing more.
 */
function languageNote(record) {
  const work = record.work?.corpus ? schoolWorkById(record.id) : null;
  if (work?.translation) return ` · ${work.translation}`;
  return work?.language ? ` · Original language · ${LANGUAGES[work.language] ?? work.language}` : '';
}

function freeEditionUrl(record) {
  return `https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent(`${record.title} ${record.author}`)}`;
}

export class School {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => {});
    this.onSelect = options.onSelect || (() => {});
    this.onAddressChange = options.onAddressChange || (() => {});
    this.manifest = null;
    this.path = null;
    this.divisions = new Map();
    this._events = new AbortController();
    this._destroyed = false;
    this.focus = parseFocus(options.initialFocus);
    if (this.focus.kind === 'path') this.path = this.focus.id;

    this.render();
    this.container.addEventListener('click', event => this.handleClick(event), { signal: this._events.signal });
    this._phone = window.matchMedia?.(PHONE) || null;
    this._phone?.addEventListener?.('change', () => this.applyPhone(), { signal: this._events.signal });
    this.applyPhone();
    this.paint();
    this.renderLectern();

    contentStore.manifest().then(manifest => {
      if (this._destroyed) return;
      this.manifest = manifest;
      this.paint();
      this.renderLectern();
    }).catch(() => {});
  }

  // ---------- state ----------

  entryCount(record) {
    if (record.work?.corpus) return schoolWorkById(record.id)?.units || 0;
    if (record.work?.entry) return 1;
    return (record.work && getTextById(record.work.id)?.chapterCount) || 0;
  }

  /** absent | carried | readable | begun | read | arcanum */
  pointState(record) {
    const progress = readState(record.id, this.entryCount(record));
    if (progress === 'read') return record.degree === 3 ? 'arcanum' : 'read';
    const { state } = schoolStatus(record, this.manifest);
    return progress === 'begun' && state === 'readable' ? 'begun' : state;
  }

  seals(houseId) {
    const entryCountOf = id => this.entryCount(recordById(id));
    return {
      read: houseSeals(houseId, entryCountOf),
      of: recordsOfHouse(houseId).length,
      arcanum: holdsArcanum(houseId, entryCountOf)
    };
  }

  // ---------- the frame and the Wheel ----------

  render() {
    this.container.innerHTML = `
      <div class="school">
        <div class="school-scroll">
          ${roomHeader({ back: 'Library', backClass: 'school-back' })}
          <div class="school-inner">
            <header class="school-heading">
              ${roomEyebrow('Library')}
              <h1 class="room-title">The Mystery School</h1>
              <p class="room-deck school-deck">Sixty-six texts in seven houses, climbing from the Gate through three degrees.</p>
            </header>
            <div class="school-body">
              <div class="school-map">
                ${this.wheelMarkup()}
                <div class="school-paths" role="group" aria-label="Paths">
                  ${SCHOOL_PATHS.map(path => `
                    <button type="button" class="school-chip" data-path="${path.id}" aria-pressed="false">${escapeHtml(path.name)}</button>
                  `).join('')}
                </div>
              </div>
              <section class="school-lectern" aria-live="polite" aria-label="Lectern"></section>
            </div>
          </div>
        </div>
      </div>`;
  }

  wheelMarkup() {
    const box = `${-VIEW} ${-VIEW} ${2 * VIEW} ${2 * VIEW}`;
    const sectors = HOUSES.map(house => `
      <path class="school-sector" data-sector="${house.id}" style="${hueStyle(house)}" d="${sectorPath(house.order)}"></path>`).join('');
    const rings = Object.values(RING_RADIUS).map(radius => `
      <circle class="school-ring" r="${radius}"></circle>`).join('');
    const numerals = DEGREES.map(degree => `
      <span class="school-numeral" aria-hidden="true" style="left: 50%; top: ${percent(-RING_RADIUS[degree.n])};">${'I'.repeat(degree.n)}</span>`).join('');
    const points = SCHOOL_CANON.filter(record => record.house !== GATE.id).map(record => {
      const { x, y } = wheelPosition(record);
      return `
        <button type="button" class="school-point" data-record="${record.id}" data-focus="${record.id}"
          style="left: ${percent(x)}; top: ${percent(y)}; ${hueStyle(houseById(record.house))}">
          <span class="school-point-label" data-side="${x > 0.35 ? 'left' : 'right'}" aria-hidden="true">${escapeHtml(record.title)}</span>
        </button>`;
    }).join('');
    const houses = HOUSES.map(house => {
      const angle = (house.order + 0.5) * WHEEL_SECTOR_DEGREES;
      const [x, y] = polar(RIM_LABEL_RADIUS, angle);
      const [px, py] = polar(RIM_LABEL_RADIUS_PHONE, angle);
      return `
        <button type="button" class="school-house" data-house="${house.id}" data-focus="${house.id}"
          style="--rim-x: ${percent(x)}; --rim-y: ${percent(y)}; --rim-x-phone: ${percent(px)}; --rim-y-phone: ${percent(py)}; ${hueStyle(house)}">
          <span class="school-glyph" aria-hidden="true">${house.glyph}</span><span class="school-house-name" aria-hidden="true">${escapeHtml(house.planet)}</span>
        </button>`;
    }).join('');
    const gateSize = `${(2 * GATE_RADIUS / (2 * VIEW) * 100).toFixed(3)}%`;
    return `
      <div class="school-wheel" data-chosen="">
        <svg class="school-svg" viewBox="${box}" aria-hidden="true" focusable="false">
          <g class="school-sectors">${sectors}</g>
          <g class="school-rings">${rings}</g>
          <circle class="school-gate-disc" r="${GATE_RADIUS}"></circle>
          <polyline class="school-path-line" pathLength="1" points="" hidden></polyline>
        </svg>
        ${numerals}
        ${points}
        ${houses}
        <button type="button" class="school-point school-gate" data-gate data-record="gate.oration" data-focus="${GATE.id}"
          style="left: 50%; top: 50%; width: max(44px, ${gateSize}); height: max(44px, ${gateSize});"></button>
      </div>`;
  }

  /** At PHONE width the text points are ink only; see the header. */
  applyPhone() {
    const phone = this._phone?.matches === true;
    for (const point of this.container.querySelectorAll('.school-point[data-record]:not([data-gate])')) {
      if (phone) {
        point.setAttribute('tabindex', '-1');
        point.setAttribute('aria-hidden', 'true');
      } else {
        point.removeAttribute('tabindex');
        point.removeAttribute('aria-hidden');
      }
    }
  }

  /** The Wheel's ink: point states, the lit path, the active house. */
  paint() {
    const wheel = this.container.querySelector('.school-wheel');
    if (!wheel) return;
    const path = pathById(this.path);
    const lit = new Set(path ? path.steps.map(step => step.record) : []);
    const activeHouse = this.focus.kind === 'house' ? this.focus.id
      : this.focus.kind === 'record' ? recordById(this.focus.id)?.house : null;

    for (const button of wheel.querySelectorAll('[data-record]')) {
      const record = recordById(button.dataset.record);
      const state = this.pointState(record);
      button.dataset.state = state;
      button.classList.toggle('is-lit', lit.has(record.id));
      button.classList.toggle('is-current', this.focus.kind === 'record' && this.focus.id === record.id);
      button.setAttribute('aria-label', record.house === GATE.id
        ? `${GATE.name}: ${record.title}, ${record.author}, ${STATE_WORDS[state]}`
        : [record.title, record.author, houseById(record.house).name, degreeName(record.degree), STATE_WORDS[state]].join(', '));
    }
    for (const button of wheel.querySelectorAll('[data-house]')) {
      const house = houseById(button.dataset.house);
      const seals = this.seals(house.id);
      button.classList.toggle('is-active', house.id === activeHouse);
      button.classList.toggle('is-arcanum', seals.arcanum);
      button.setAttribute('aria-label', `${house.name}, ${house.planet}, ${seals.read} of ${seals.of} read`);
    }
    for (const sector of wheel.querySelectorAll('[data-sector]')) {
      sector.classList.toggle('is-active', sector.dataset.sector === activeHouse);
    }

    const line = wheel.querySelector('.school-path-line');
    const drawn = wheel.dataset.chosen;
    wheel.dataset.chosen = path ? path.id : '';
    if (!path) {
      line.setAttribute('hidden', '');
      line.classList.remove('is-drawing');
    } else if (drawn !== path.id) {
      line.setAttribute('points', path.steps.map(step => {
        const { x, y } = wheelPosition(recordById(step.record));
        return `${x.toFixed(4)},${y.toFixed(4)}`;
      }).join(' '));
      line.removeAttribute('hidden');
      line.classList.remove('is-drawing');
      // Restarts the draw: the class must be seen absent before it is added again.
      line.getBoundingClientRect();
      line.classList.add('is-drawing');
    }
    for (const chip of this.container.querySelectorAll('[data-path]')) {
      chip.setAttribute('aria-pressed', String(chip.dataset.path === this.path));
    }
  }

  // ---------- the Lectern ----------

  renderLectern() {
    const lectern = this.container.querySelector('.school-lectern');
    if (!lectern) return;
    const { kind, id } = this.focus;
    lectern.dataset.focus = focusKey(this.focus);
    lectern.innerHTML = kind === 'house' ? this.houseMarkup(houseById(id))
      : kind === 'record' ? this.recordMarkup(recordById(id))
        : kind === 'path' ? this.pathMarkup(pathById(id))
          : this.gateMarkup();
    if (kind === 'record') this.loadDivisions(recordById(id));
  }

  stateWord(record) {
    return STATE_WORDS[this.pointState(record)];
  }

  actionMarkup(record) {
    const { state, reason } = schoolStatus(record, this.manifest);
    if (state === 'readable') {
      const label = record.work.entry ? `Read · ${record.work.entry}` : 'Read';
      return `<div class="school-action"><button type="button" class="school-read" data-read="${record.id}">${escapeHtml(label)}</button></div>`;
    }
    if (state === 'carried') {
      return `<div class="school-action">
        <button type="button" class="school-read" disabled>Not served yet</button>
        ${reason ? `<p class="school-reason">${escapeHtml(reason)}</p>` : ''}
      </div>`;
    }
    if (record.rights === 'orig-only') {
      return `<div class="school-action"><p class="school-reason">Original language only · ${escapeHtml(record.edition)}</p></div>`;
    }
    return `<div class="school-action">
      <a class="school-outward" href="${escapeHtml(freeEditionUrl(record))}" target="_blank" rel="noopener">Find the free edition <span class="school-outward-note">outside RISE</span>${roomIcon('external', 16)}</a>
    </div>`;
  }

  houseButton(house) {
    const seals = this.seals(house.id);
    return `<button type="button" class="school-link school-house-link" data-focus="${house.id}" style="${hueStyle(house)}">
      <span class="school-glyph" aria-hidden="true">${house.glyph}</span>
      <span class="school-house-link-name">${escapeHtml(house.name)}</span>
      <span class="school-seals">${seals.read} of ${seals.of} read${seals.arcanum ? ' · arcanum held' : ''}</span>
    </button>`;
  }

  gateMarkup() {
    const oration = recordById('gate.oration');
    return `
      <p class="school-kicker">${escapeHtml(GATE.name)}</p>
      <div class="school-charter">${CHARTER.map(line => `<p>${escapeHtml(line)}</p>`).join('')}</div>
      <section class="school-gate-text">
        <h2 class="school-title">${escapeHtml(oration.title)}</h2>
        <p class="school-meta">${escapeHtml(oration.author)} · ${escapeHtml(oration.date)}</p>
        <p class="school-state">${escapeHtml(this.stateWord(oration) + languageNote(oration))}${oration.note ? `. ${escapeHtml(oration.note)}.` : ''}</p>
        <button type="button" class="school-link" data-focus="${oration.id}">About this text</button>
      </section>
      <h3 class="school-subhead">The seven houses</h3>
      <ul class="school-list">${[...HOUSES].sort((a, b) => a.order - b.order)
        .map(house => `<li>${this.houseButton(house)}</li>`).join('')}</ul>`;
  }

  houseMarkup(house) {
    const seals = this.seals(house.id);
    const records = recordsOfHouse(house.id);
    const groups = DEGREES.map(degree => {
      const rows = records.filter(record => record.degree === degree.n);
      if (!rows.length) return '';
      return `
        <section class="school-degree">
          <h3 class="school-subhead">${'I'.repeat(degree.n)} · ${escapeHtml(degree.name)}</h3>
          <ul class="school-list">${rows.map(record => `
            <li class="school-row">
              <button type="button" class="school-row-title" data-focus="${record.id}">${escapeHtml(record.title)}</button>
              <span class="school-meta">${escapeHtml(record.author)} · ${escapeHtml(record.date)}</span>
              <span class="school-state">${escapeHtml(this.stateWord(record))}</span>
              ${this.actionMarkup(record)}
            </li>`).join('')}
          </ul>
        </section>`;
    }).join('');
    return `
      <header class="school-house-head" style="${hueStyle(house)}">
        <span class="school-glyph school-glyph-large" aria-hidden="true">${house.glyph}</span>
        <div>
          <h2 class="school-title">${escapeHtml(house.name)}</h2>
          <p class="school-meta">${escapeHtml(house.planet)} · ${escapeHtml(house.reading)}</p>
        </div>
      </header>
      <p class="school-seals">${seals.read} of ${seals.of} read${seals.arcanum ? ' · arcanum held' : ''}</p>
      ${groups}`;
  }

  recordMarkup(record) {
    const house = houseById(record.house);
    const place = record.house === GATE.id ? GATE.name : `${degreeName(record.degree)} · ${house.name}`;
    const bridges = record.bridges.map(id => houseById(id)).filter(Boolean);
    const paths = pathsOfRecord(record.id);
    const divisible = schoolStatus(record, this.manifest).state === 'readable' && !record.work.entry;
    // A corpus work names the edition it was ingested from, not the plan's.
    const edition = (record.work?.corpus && schoolWorkById(record.id)?.edition.statement) || record.edition;
    return `
      <p class="school-kicker" style="${hueStyle(house)}">${escapeHtml(place)}</p>
      <h2 class="school-title">${escapeHtml(record.title)}</h2>
      <p class="school-meta">${escapeHtml(record.author)} · ${escapeHtml(record.date)}</p>
      <p class="school-why">${escapeHtml(record.why)}</p>
      <dl class="school-facts">
        <div><dt>Edition</dt><dd>${escapeHtml(edition)}</dd></div>
        <div><dt>Rights</dt><dd>${escapeHtml(rightsLine(record))}</dd></div>
        <div><dt>State</dt><dd>${escapeHtml(this.stateWord(record) + languageNote(record))}</dd></div>
      </dl>
      ${record.note ? `<p class="school-note">${escapeHtml(record.note)}</p>` : ''}
      ${record.work?.corpus && schoolWorkById(record.id)?.imagery
        ? '<p class="school-note">A picture work: each unit is one plate; the plate is the reading\'s field.</p>' : ''}
      ${bridges.length ? `<p class="school-links"><span class="school-meta">Crosses</span>${bridges.map(other => `
        <button type="button" class="school-link" data-focus="${other.id}">${other.glyph} ${escapeHtml(other.name)}</button>`).join('')}</p>` : ''}
      ${paths.length ? `<p class="school-links"><span class="school-meta">On</span>${paths.map(path => `
        <button type="button" class="school-link" data-focus="path-${path.id}">${escapeHtml(path.name)}</button>`).join('')}</p>` : ''}
      ${this.actionMarkup(record)}
      ${divisible ? '<div class="school-divisions" data-divisions>…</div>' : ''}`;
  }

  pathMarkup(path) {
    const firstReadable = path.steps.find(step => schoolStatus(recordById(step.record), this.manifest).state === 'readable');
    return `
      <p class="school-kicker">Path</p>
      <h2 class="school-title">${escapeHtml(path.name)}</h2>
      ${path.question ? `<p class="school-why">${escapeHtml(path.question)}</p>` : ''}
      <ol class="school-steps">${path.steps.map(step => {
        const record = recordById(step.record);
        return `
          <li class="school-step">
            <button type="button" class="school-row-title" data-focus="${record.id}">${escapeHtml(record.title)}</button>
            <span class="school-meta">${escapeHtml(record.author)}${step.part ? ` · ${escapeHtml(step.part)}` : ''}</span>
            <span class="school-state">${escapeHtml(this.stateWord(record))}</span>
            ${step === firstReadable ? this.actionMarkup(record) : ''}
          </li>`;
      }).join('')}
      </ol>`;
  }

  /** A readable divided work lists its divisions once they arrive; an undivided one lists none. */
  async loadDivisions(record) {
    const slot = this.container.querySelector('[data-divisions]');
    if (!slot) return;
    const text = record.work.corpus ? null : getTextById(record.work.id);
    const load = record.work.corpus ? () => corpusDivisions(record.id)
      : typeof text?.getDivisions === 'function' ? () => text.getDivisions() : null;
    if (!load) {
      slot.remove();
      return;
    }
    let divisions = this.divisions.get(record.id);
    if (!divisions) {
      try {
        divisions = await load();
      } catch {
        divisions = null;
      }
      this.divisions.set(record.id, divisions);
    }
    const current = this.container.querySelector('[data-divisions]');
    if (this._destroyed || current !== slot) return;
    if (!divisions?.divided) {
      slot.remove();
      return;
    }
    const read = new Set(readProgress().read[record.id]?.entries || []);
    slot.innerHTML = `<ol class="school-division-list">${divisions.entries.map((entry, index) => `
      <li class="school-division${read.has(String(entry.id)) ? ' is-read' : ''}">
        <button type="button" class="school-link" data-read="${record.id}" data-entry="${index}">Read · ${escapeHtml(entry.label)}</button>
        ${read.has(String(entry.id)) ? '<span class="school-state">Read</span>' : ''}
      </li>`).join('')}
    </ol>`;
  }

  // ---------- what the reader does ----------

  handleClick(event) {
    const target = event.target.closest('[data-action], [data-read], [data-path], [data-focus]');
    if (!target || !this.container.contains(target) || target.disabled) return;
    if (target.dataset.action === 'back') {
      this.onNavigate('library');
      return;
    }
    if (target.dataset.read) {
      const entry = target.dataset.entry;
      this.onSelect({ recordId: target.dataset.read, entryIndex: entry === undefined ? null : Number(entry) });
      return;
    }
    if (target.dataset.path) {
      if (this.path === target.dataset.path) this.clearPath();
      else this.setFocus({ kind: 'path', id: target.dataset.path });
      return;
    }
    this.setFocus(parseFocus(target.dataset.focus), { fromWheel: Boolean(target.closest('.school-wheel')) });
  }

  setFocus(focus, { announce = true, fromWheel = false } = {}) {
    this.focus = focus;
    if (focus.kind === 'path') this.path = focus.id;
    this.paint();
    this.renderLectern();
    if (announce) this.onAddressChange({ focus: focus.kind === 'gate' ? null : focusKey(focus) });
    if (fromWheel && window.matchMedia?.(STACKED).matches) {
      this.container.querySelector('.school-lectern')?.scrollIntoView?.({ block: 'start' });
    }
  }

  /** Clears the chosen path; the Lectern leaves it for the Gate if it was showing it. */
  clearPath() {
    if (!this.path) return false;
    this.path = null;
    if (this.focus.kind === 'path') {
      this.setFocus({ kind: 'gate', id: GATE.id });
    } else {
      this.paint();
    }
    return true;
  }

  handleEscape() {
    return this.clearPath();
  }

  update(data) {
    this.setFocus(parseFocus(data?.focus), { announce: false });
  }

  activate() {
    this.paint();
    this.renderLectern();
  }

  deactivate() {}

  destroy() {
    this._destroyed = true;
    this._events.abort();
    this.container.innerHTML = '';
  }
}
