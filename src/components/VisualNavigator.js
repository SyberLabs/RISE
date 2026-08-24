/**
 * VisualNavigator — the field, chosen by walking a directory.
 *
 * The Orbital's five-mode selector and its flat word-source dropdown are
 * replaced by the canonical tree: Off · Visual → { Focal, Gallery, Dynamic }.
 * A reader descends the columns, opens a leaf's entry — its name, nature,
 * substyles, and one switch — and the room changes. Every rule about what may
 * be on at once lives in visual-taxonomy.js; every rule about how a choice
 * becomes a score lives in visual-taxonomy-config.js. This draws them.
 *
 * IT COMPUTES NO CONFIG OF ITS OWN. On any change it hands `configPatch` the
 * whole selection and emits the patch — the same discipline the admit room
 * kept with the partition: the view renders and reports, the model decides.
 *
 * Not yet wired into the Chamber. It is built and tested first, the way the
 * admit room was, so the live-panel surgery is a mount rather than a rewrite.
 */

import { escapeHtml } from '../core/sanitize.js';
import {
  FIELD,
  VISUAL_TAXONOMY,
  categoryOf,
  describeField,
  galleryMembers,
  isBlend,
  substylesFor,
  toggleField
} from '../core/visual-taxonomy.js';
import {
  configPatch,
  poolOptions,
  selectionFromConfig
} from '../core/visual-taxonomy-config.js';
import { FOCAL_GLYPHS } from '../core/visual-style-definitions.js';
import './VisualNavigator.css';

const ROOT = VISUAL_TAXONOMY.children;   // [off, visual]

/** An option in a substyle bench may be a string or a { id, name } record. */
const optId = o => (typeof o === 'string' ? o : o.id);
const optLabel = o => (typeof o === 'string' ? o[0].toUpperCase() + o.slice(1) : (o.name || o.label || o.id));

export class VisualNavigator {
  constructor(container, options = {}) {
    this.container = container;
    this.onChange = options.onChange || (() => {});
    this.selection = selectionFromConfig(options.visualConfig || {});
    this.path = [];          // branch nodes descended, under ROOT
    this.focus = null;       // the open leaf, or null
    this._destroyed = false;

    // Arrive on whatever is already enabled, so reopening shows the reading.
    const first = [...this.selection.enabled][0];
    if (first) this.openLeafById(first);

    this.render();
  }

  /* ── selection helpers ────────────────────────────────────────────── */
  patch() { return configPatch(this.selection); }
  emit() { if (!this._destroyed) this.onChange(this.patch()); }

  styleOf(engineId) {
    return this.selection.style[engineId === 'genesis' ? 'klee' : engineId] || {};
  }

  /* ── navigation ───────────────────────────────────────────────────── */
  columns() {
    const cols = [ROOT];
    for (const node of this.path) if (node.children) cols.push(node.children);
    return cols;
  }

  openLeafById(id) {
    // Walk to the leaf so its column chain is shown around it.
    const trail = [];
    const find = (nodes, chain) => {
      for (const n of nodes) {
        if (n.id === id) { trail.push(...chain, n); return true; }
        if (n.children && find(n.children, [...chain, n])) return true;
      }
      return false;
    };
    find(ROOT, []);
    if (!trail.length) return;
    this.focus = trail[trail.length - 1];
    this.path = trail.slice(0, -1).filter(n => n.children);
  }

  navigate(colIndex, node) {
    this.path = this.path.slice(0, colIndex);
    if (node.children) { this.path.push(node); this.focus = null; }
    else { this.focus = node; }
    this.render();
  }

  /* ── mutation ─────────────────────────────────────────────────────── */
  toggleEnabled() {
    const leaf = this.focus;
    if (!leaf || !categoryOf(leaf.id)) return;
    // The one rule lives in the model; call it and take the new set.
    this.selection.enabled = toggleField(this.selection.enabled, leaf.id);
    this.emit();
    this.render();
  }

  setSubstyle(engineId, key, value) {
    const bucket = engineId === 'genesis' ? 'klee' : engineId;
    this.selection.style[bucket] = { ...this.selection.style[bucket], [key]: value };
    this.emit();
    this.render();
  }

  setGlyph(glyph) { this.selection.style.focal = { glyph }; this.emit(); this.render(); }
  setGlass(on) { this.selection.style.klee = { ...this.selection.style.klee, glass: on }; this.emit(); this.render(); }
  setPool(leafId, poolId) { this.selection.pool = { ...this.selection.pool, [leafId]: poolId }; this.emit(); this.render(); }

  /* ── render ───────────────────────────────────────────────────────── */
  render() {
    if (this._destroyed) return;
    const cols = this.columns();
    this.container.innerHTML = `
      <div class="vnav">
        <div class="vnav-bar">
          <span class="vnav-path">${this.pathBar()}</span>
          <span class="vnav-field">${escapeHtml(describeField(this.selection.enabled))}</span>
        </div>
        <div class="vnav-body">
          ${cols.map((nodes, i) => this.renderColumn(nodes, i)).join('')}
          <div class="vnav-entry">${this.renderEntry()}</div>
        </div>
      </div>`;
    this.attach();
  }

  pathBar() {
    const names = this.path.map(n => `<span>${escapeHtml(n.label.toLowerCase())}</span>`);
    if (this.focus) names.push(`<span class="here">${escapeHtml(this.focus.label.toLowerCase())}</span>`);
    return names.length ? names.join('<i>/</i>') : '<span>field</span>';
  }

  renderColumn(nodes, colIndex) {
    const rows = nodes.map(n => {
      const selected = this.path[colIndex] === n || this.focus === n;
      const on = categoryOf(n.id) && this.selection.enabled.has(n.id);
      return `
        <button type="button" class="vnav-node ${selected ? 'sel' : ''} ${on ? 'on' : ''}"
          data-col="${colIndex}" data-id="${escapeHtml(n.id)}">
          <span class="g">${glyphFor(n)}</span>
          <span class="nm">${escapeHtml(n.label)}</span>
          ${on ? '<span class="dot" aria-label="in the room"></span>' : ''}
          ${n.children ? '<span class="arw">›</span>' : ''}
        </button>`;
    }).join('');
    return `<div class="vnav-col">${rows}</div>`;
  }

  renderEntry() {
    const leaf = this.focus;
    if (!leaf || !categoryOf(leaf.id)) {
      return `<div class="vnav-empty"><span>◈</span>Choose a field to open its entry</div>`;
    }
    const cat = categoryOf(leaf.id);
    const enabled = this.selection.enabled.has(leaf.id);
    const blend = cat === FIELD.GALLERY && enabled && isBlend(this.selection.enabled);
    const kind = cat === FIELD.DYNAMIC ? 'Dynamic · drawn in time'
      : cat === FIELD.GALLERY ? 'Gallery · held presence'
      : cat === FIELD.FOCAL ? 'Gallery · a single point' : 'Field';

    const commit = `
      <div class="vnav-commit">
        <button type="button" class="vnav-toggle ${enabled ? 'on' : ''}" data-action="toggle"
          role="switch" aria-checked="${enabled}">
          <span class="knob"></span>
        </button>
        <span class="vnav-commit-label">${
          blend ? `In the blend · ${galleryMembers(this.selection.enabled).length} in gallery`
          : enabled ? 'In the room' : 'Bring into the room'
        }</span>
      </div>`;

    return `
      <div class="vnav-entry-head">
        <span class="vnav-glyph">${glyphFor(leaf)}</span>
        <div>
          <h3>${escapeHtml(leaf.label)}</h3>
          <p class="vnav-kind">${kind}${blend ? ' · <b>Blend</b>' : ''}</p>
        </div>
      </div>
      <div class="vnav-preview" aria-hidden="true">
        <span class="vnav-preview-glyph">${glyphFor(leaf)}</span>
        <span class="vnav-preview-note">live preview mounts here</span>
      </div>
      ${leaf.desc ? `<p class="vnav-desc">${escapeHtml(leaf.desc)}</p>` : ''}
      ${this.renderBenches(leaf)}
      ${commit}`;
  }

  renderBenches(leaf) {
    let html = '';

    if (leaf.id === 'focal') {
      html += bench('Glyph', FOCAL_GLYPHS.map(g => ({
        id: g.id, label: g.glyph || g.id, on: this.selection.style.focal.glyph === g.id,
        attr: `data-glyph="${escapeHtml(g.id)}"`
      })));
    }

    if (leaf.engineId) {
      const style = this.styleOf(leaf.engineId);
      for (const b of substylesFor(leaf.engineId)) {
        html += bench(b.label, b.options.map(o => ({
          id: optId(o), label: optLabel(o), on: style[b.key] === optId(o), swatch: o.swatch,
          attr: `data-sub="${escapeHtml(b.key)}" data-val="${escapeHtml(optId(o))}"`
        })));
      }
      if (leaf.engineId === 'klee') {
        html += `<label class="vnav-glass"><input type="checkbox" data-action="glass"
          ${this.selection.style.klee.glass !== false ? 'checked' : ''}> Glass tile behind the text</label>`;
      }
    }

    if (leaf.pool) {
      const options = poolOptions(leaf.id);
      const cur = this.selection.pool[leaf.id];
      html += bench('Pool', options.map(o => ({
        id: o.id, label: o.label, on: cur === o.id, attr: `data-pool="${escapeHtml(o.id)}"`
      })));
    }

    return html;
  }

  attach() {
    this.container.querySelectorAll('.vnav-node').forEach(b =>
      b.onclick = () => {
        const col = Number(b.dataset.col);
        const node = this.columns()[col].find(n => n.id === b.dataset.id);
        if (node) this.navigate(col, node);
      });
    const q = sel => this.container.querySelector(sel);
    q('[data-action="toggle"]')?.addEventListener('click', () => this.toggleEnabled());
    q('[data-action="glass"]')?.addEventListener('change', e => this.setGlass(e.target.checked));
    this.container.querySelectorAll('[data-sub]').forEach(b =>
      b.onclick = () => this.setSubstyle(this.focus.engineId, b.dataset.sub, b.dataset.val));
    this.container.querySelectorAll('[data-glyph]').forEach(b =>
      b.onclick = () => this.setGlyph(b.dataset.glyph));
    this.container.querySelectorAll('[data-pool]').forEach(b =>
      b.onclick = () => this.setPool(this.focus.id, b.dataset.pool));
  }

  destroy() { this._destroyed = true; this.container.innerHTML = ''; }
}

function glyphFor(node) {
  const glyphs = { off: '○', visual: '❖', focal: '◯', gallery: '▦',
    'gallery-procedural': '❋', 'gallery-sourced': '▤', personal: '◈', dynamic: '∮',
    attractor: '∮', klee: '✎', harmonograph: '∿', ostensoria: '✷', apparitio: '❂',
    fractal: '❋', turrell: '◗', rockgarden: '⬡', neural: '⧉',
    'by-manner': '◐', 'by-subject': '◑', science: '◉' };
  return glyphs[node.id] || '·';
}

function bench(label, opts) {
  return `
    <div class="vnav-bench">
      <span class="vnav-bench-label">${escapeHtml(label)}</span>
      <div class="vnav-opts">
        ${opts.map(o => `
          <button type="button" class="vnav-opt ${o.on ? 'on' : ''} ${o.swatch ? 'swatch' : ''}" ${o.attr}>
            ${o.swatch ? `<i style="background:${escapeHtml(o.swatch)}"></i>` : ''}${escapeHtml(String(o.label))}
          </button>`).join('')}
      </div>
    </div>`;
}
