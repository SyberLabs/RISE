import { visualCortex } from '../visuals/visual-cortex.js';
import { resolveFitProjection } from './fit-projection.js';
import { GROUNDS, maskGroundFromConfig } from './mask-ground.js';
import { resolveSessionWordFill } from './visual-selection.js';

/**
 * Fit-mask runtime the Chamber mounts. Viewport, inline SVG mask, hydration
 * gate and reveal/fallback live here. Chamber asks apply / sync; it does not
 * own the state machine.
 */
export class FitMaskRuntime {
  constructor(chamber) {
    this.chamber = chamber;
  }

  applies() {
    return this.chamber.chamberMaskApplies();
  }

  sourceConfig() {
    return this.chamber._maskSourceConfig();
  }

  apply() {
    const c = this.chamber;
    const atomDisplay = c.container.querySelector('#atom-display');
    if (!atomDisplay) return;
    if (this.applies()) {
      atomDisplay.classList.add('is-mask');
      atomDisplay.classList.remove('glass-tile');
      this.ensure();
      this.syncGround();
    } else {
      atomDisplay.classList.remove('is-mask');
      atomDisplay.classList.remove('is-mask-ink', 'is-mask-ready');
      atomDisplay.dataset.maskState = 'inactive';
      this.destroyField();
    }
  }

  removeGroundPlate() {
    const c = this.chamber;
    if (c.maskGroundPlate) {
      c.maskGroundPlate.remove();
      c.maskGroundPlate = null;
    }
  }

  syncGround() {
    const c = this.chamber;
    const wrapper = c.fillFieldHost;
    const layerA = c.container.querySelector('#chamber-continuous-field');
    if (!this.applies() || !wrapper) {
      this.removeGroundPlate();
      return;
    }

    const sourceConfig = this.sourceConfig();
    const roomOpaque = Boolean(visualCortex._continuousField?.currentUrl)
      || Boolean(layerA?.querySelector('.continuous-field-artwork[src]'));
    const ground = maskGroundFromConfig({
      ...sourceConfig,
      roomOpaque
    });

    if (ground === GROUNDS.transparent) {
      this.removeGroundPlate();
      return;
    }

    let plate = c.maskGroundPlate;
    if (!plate || plate.parentNode !== wrapper) {
      plate = document.createElement('div');
      plate.className = 'chamber-mask-ground-plate';
      plate.setAttribute('aria-hidden', 'true');
      c.maskGroundPlate = plate;
    }
    if (wrapper.firstChild !== plate) {
      wrapper.insertBefore(plate, wrapper.firstChild);
    }
    plate.dataset.ground = ground;
    wrapper.style.removeProperty('background');
    wrapper.style.removeProperty('background-color');
  }

  shouldMount() {
    const c = this.chamber;
    return this.applies()
      && !c.pageModeActive
      && !c._temporalVisualsDeferred
      && visualCortex.hasContinuousFieldHost?.();
  }

  async waitThickFontReady(text) {
    if (!document.fonts?.load) return true;
    const loaded = await document.fonts.load('700 1em "Space Grotesk"', text);
    return loaded.length > 0;
  }

  maskImageSupported() {
    if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false;
    try {
      return CSS.supports('mask-image', 'url("#x")')
        || CSS.supports('-webkit-mask-image', 'url("#x")')
        || CSS.supports('mask-image', 'url(#x)');
    } catch {
      return false;
    }
  }

  atomHasWordInk(atomDisplay) {
    if (!atomDisplay || atomDisplay.querySelector('.atom-seam')) return false;
    return (atomDisplay.textContent || '').trim().length > 0;
  }

  ensureFitMaskNode() {
    const c = this.chamber;
    if (c._fitMaskSvg?.isConnected) return c._fitMaskSvg;
    const field = c.container.querySelector('#chamber-field');
    if (!field) return null;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'chamber-fit-mask-defs');
    svg.setAttribute('aria-hidden', 'true');
    const defs = document.createElementNS(ns, 'defs');
    const mask = document.createElementNS(ns, 'mask');
    // The id is rotated per paint (see below), so creation only needs a
    // starting one. The random part keeps two Chambers from colliding.
    if (!c._fitMaskSeed) {
      c._fitMaskSeed = `chamber-fit-mask-${Math.random().toString(36).slice(2, 9)}`;
    }
    c._fitMaskId = this.nextMaskId();
    mask.setAttribute('id', c._fitMaskId);
    mask.setAttribute('maskUnits', 'userSpaceOnUse');
    mask.setAttribute('maskContentUnits', 'userSpaceOnUse');
    const text = document.createElementNS(ns, 'text');
    c._fitGlyphId = `${c._fitMaskId}-glyph`;
    text.setAttribute('id', c._fitGlyphId);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    const maskUse = document.createElementNS(ns, 'use');
    maskUse.setAttribute('class', 'chamber-fit-mask-glyph');
    maskUse.setAttribute('href', `#${c._fitGlyphId}`);
    maskUse.setAttribute('fill', '#fff');
    const contour = document.createElementNS(ns, 'use');
    contour.setAttribute('class', 'chamber-fit-glyph-contour');
    contour.setAttribute('href', `#${c._fitGlyphId}`);
    contour.setAttribute('fill', 'none');
    contour.setAttribute('aria-hidden', 'true');
    defs.appendChild(text);
    mask.appendChild(maskUse);
    svg.append(defs, mask, contour);
    field.appendChild(svg);
    c._fitMaskSvg = svg;
    c._fitMaskMask = mask;
    c._fitMaskText = text;
    c._fitMaskUse = maskUse;
    c._fitMaskContour = contour;
    return svg;
  }

  clearFillMask() {
    const host = this.chamber.fillFieldHost;
    if (!host) return;
    host.style.maskImage = 'none';
    host.style.webkitMaskImage = 'none';
  }

  revertToOpaqueWord(
    maskState = 'fallback',
    atomDisplay = this.chamber.container.querySelector('#atom-display')
  ) {
    const c = this.chamber;
    atomDisplay?.classList.remove('is-mask-ink', 'is-mask-ready');
    c._fitMaskSvg?.classList.remove('is-ready');
    if (atomDisplay) atomDisplay.dataset.maskState = maskState;
    if (atomDisplay?.style.color === 'transparent') {
      atomDisplay.style.removeProperty('color');
    }
    if (c.fillFieldHost) {
      c.fillFieldHost.classList.add('is-hidden');
      this.clearFillMask();
    }
  }

  ensure() {
    const c = this.chamber;
    if (!this.shouldMount() || !this.maskImageSupported()) {
      this.destroyField();
      return;
    }
    const field = c.container.querySelector('#chamber-field');
    if (!field) return;
    if (!c.fillFieldHost) {
      const host = document.createElement('div');
      host.className = 'chamber-fill-field chamber-continuous-field';
      host.setAttribute('aria-hidden', 'true');
      host.classList.add('is-hidden');
      c._insertBehindReading(field, host);
      c.fillFieldHost = host;
    }
    if (!c.fillViewport || c.fillViewport.parentElement !== c.fillFieldHost) {
      const viewport = document.createElement('div');
      viewport.className = 'chamber-fill-viewport';
      c.fillFieldHost.appendChild(viewport);
      c.fillViewport = viewport;
    }
    visualCortex.setContinuousFieldProjectionHost(c.fillViewport);
    this.syncGround();
    void this.sync();
  }

  async sync() {
    const c = this.chamber;
    const generation = ++c._fillMaskGeneration;
    const field = c.container.querySelector('#chamber-field');
    const atomDisplay = c.container.querySelector('#atom-display');
    const context = c._textMaterialCapabilityContext();
    const fallbackState = context.capability.maskActive ? 'fallback' : 'inactive';

    const mountable = context.capability.maskActive
      && this.shouldMount()
      && this.maskImageSupported()
      && !!field && !!atomDisplay && !!c.fillFieldHost && !!c.fillViewport
      && this.atomHasWordInk(atomDisplay);
    if (!mountable) {
      this.revertToOpaqueWord(fallbackState, atomDisplay);
      return;
    }

    const host = c.fillFieldHost;
    const viewport = c.fillViewport;
    const text = (atomDisplay.textContent || '').trim();
    const materialKey = context.materialKey;

    if (this.materialHydrated(viewport, text)
      && this.paint({ field, atomDisplay, host, viewport, text })) {
      this.reveal(atomDisplay, host);
      return;
    }

    this.revertToOpaqueWord(fallbackState, atomDisplay);
    atomDisplay.dataset.maskState = 'preparing';

    try {
      const [fontReady] = await Promise.all([
        this.waitThickFontReady(text),
        visualCortex.whenContinuousFieldProjectionReady(viewport)
      ]);
      if (!fontReady) {
        if (generation === c._fillMaskGeneration) this.revertToOpaqueWord();
        return;
      }
    } catch {
      if (generation === c._fillMaskGeneration
        && atomDisplay === c.container.querySelector('#atom-display')) {
        this.revertToOpaqueWord();
      }
      return;
    }

    const contextStillCurrent = () => {
      const current = c._textMaterialCapabilityContext();
      return generation === c._fillMaskGeneration
        && atomDisplay === c.container.querySelector('#atom-display')
        && (atomDisplay.textContent || '').trim() === text
        && c.fillFieldHost === host
        && c.fillViewport === viewport
        && current.capability.maskActive
        && current.materialKey === materialKey;
    };

    const rejectChangedContext = () => {
      if (generation !== c._fillMaskGeneration
        || atomDisplay !== c.container.querySelector('#atom-display')) return;
      const current = c._textMaterialCapabilityContext();
      this.revertToOpaqueWord(current.capability.maskActive ? 'fallback' : 'inactive');
    };

    if (!contextStillCurrent()) {
      rejectChangedContext();
      return;
    }

    if (!this.paint({ field, atomDisplay, host, viewport, text })) {
      this.revertToOpaqueWord();
      return;
    }

    await new Promise(resolve => {
      requestAnimationFrame(() => {
        if (contextStillCurrent()) this.reveal(atomDisplay, host);
        resolve();
      });
    });
  }

  materialHydrated(viewport, text) {
    if (!visualCortex.isContinuousFieldProjectionPainted?.(viewport)) return false;
    if (typeof document.fonts?.check !== 'function') return false;
    try {
      return document.fonts.check('700 1em "Space Grotesk"', text);
    } catch {
      return false;
    }
  }

  paint({ field, atomDisplay, host, viewport, text }) {
    const c = this.chamber;
    const fieldRect = field.getBoundingClientRect();
    const atomRect = atomDisplay.getBoundingClientRect();
    const fieldWidth = field.clientWidth || fieldRect.width;
    const fieldHeight = field.clientHeight || fieldRect.height;
    if (fieldWidth < 2 || fieldHeight < 2 || atomRect.width < 1 || atomRect.height < 1) {
      return false;
    }

    const cs = getComputedStyle(atomDisplay);
    const paddingLeft = parseFloat(cs.paddingLeft) || 0;
    const paddingRight = parseFloat(cs.paddingRight) || 0;
    const paddingTop = parseFloat(cs.paddingTop) || 0;
    const paddingBottom = parseFloat(cs.paddingBottom) || 0;
    const contentWidth = Math.max(0, atomRect.width - paddingLeft - paddingRight);
    const contentHeight = Math.max(0, atomRect.height - paddingTop - paddingBottom);
    const textX = (atomRect.left - fieldRect.left) + paddingLeft + (contentWidth / 2);
    const textY = (atomRect.top - fieldRect.top) + paddingTop + (contentHeight / 2);

    const projection = resolveFitProjection({
      fieldRect: { left: 0, top: 0, width: fieldWidth, height: fieldHeight },
      glyphRect: {
        left: (atomRect.left - fieldRect.left) + paddingLeft,
        top: (atomRect.top - fieldRect.top) + paddingTop,
        width: contentWidth,
        height: contentHeight
      },
      devicePixelRatio: window.devicePixelRatio || 1
    });
    if (!projection) return false;
    const view = projection.projection;
    viewport.style.left = `${view.left}px`;
    viewport.style.top = `${view.top}px`;
    viewport.style.width = `${view.width}px`;
    viewport.style.height = `${view.height}px`;
    viewport.style.right = 'auto';
    viewport.style.bottom = 'auto';
    visualCortex.setFillProjectionVisibleAreaRatio(projection.visibleAreaRatio);

    if (!this.ensureFitMaskNode()) return false;
    const maskEl = c._fitMaskMask;
    const textEl = c._fitMaskText;
    const contour = c._fitMaskContour;
    c._fitMaskSvg.setAttribute('width', String(fieldWidth));
    c._fitMaskSvg.setAttribute('height', String(fieldHeight));
    c._fitMaskSvg.setAttribute('viewBox', `0 0 ${fieldWidth} ${fieldHeight}`);
    maskEl.setAttribute('x', '0');
    maskEl.setAttribute('y', '0');
    maskEl.setAttribute('width', String(fieldWidth));
    maskEl.setAttribute('height', String(fieldHeight));
    textEl.setAttribute('x', String(textX));
    textEl.setAttribute('y', String(textY));
    textEl.setAttribute('font-family', cs.fontFamily || 'sans-serif');
    textEl.setAttribute('font-size', cs.fontSize || '96px');
    textEl.setAttribute('font-weight', cs.fontWeight || '700');
    textEl.setAttribute('font-style', cs.fontStyle || 'normal');
    if (cs.letterSpacing && cs.letterSpacing !== 'normal') {
      textEl.setAttribute('letter-spacing', cs.letterSpacing);
    } else {
      textEl.removeAttribute('letter-spacing');
    }
    textEl.textContent = text;
    const borderColor = atomDisplay.style.getPropertyValue('--fit-border-color').trim();
    contour.setAttribute('stroke', borderColor || 'transparent');
    contour.setAttribute('stroke-width', String(Math.min(2, Math.max(0.75, (parseFloat(cs.fontSize) || 0) * 0.1))));

    // ...AND ONLY FOR A NEW GLYPH.
    //
    // paint() runs on every re-fit and resize, not once per word — measured
    // at roughly twenty calls per word. Rotating on each of those would
    // rewrite the rule twenty times to say the same thing. The reference
    // moves when what it references does.
    const signature = [
      text, textX, textY, fieldWidth, fieldHeight,
      cs.fontFamily, cs.fontSize, cs.fontWeight, cs.fontStyle, cs.letterSpacing
    ].join('|');
    if (signature === c._fitMaskSignature && c._fitMaskId) {
      const held = `url("#${c._fitMaskId}")`;
      if (host.style.maskImage !== held) {
        host.style.maskImage = held;
        host.style.webkitMaskImage = held;
      }
      return true;
    }
    c._fitMaskSignature = signature;

    // A NEW NAME FOR A NEW GLYPH.
    //
    // The id was minted once per Chamber, so `mask-image: url("#id")` was one
    // unchanging string for a whole reading while the <mask> underneath it
    // was rewritten every word. Chromium re-rasterises anyway. WebKit is not
    // obliged to: with no change to the property and no change to the
    // referenced URL, it may keep the raster it already has — which is a Fit
    // word frozen on the reading's FIRST glyph, at that glyph's size, while
    // the atom moves on and shows only its border. Reported from iOS Safari
    // as a giant "A" over the word "sent".
    //
    // Rotating the id changes the property's value with its content, so every
    // engine must resolve it again. It costs one attribute write on a node
    // this function is already writing to.
    c._fitMaskId = this.nextMaskId();
    c._fitMaskMask.setAttribute('id', c._fitMaskId);
    c._fitGlyphId = `${c._fitMaskId}-glyph`;
    c._fitMaskText.setAttribute('id', c._fitGlyphId);
    c._fitMaskUse.setAttribute('href', `#${c._fitGlyphId}`);
    c._fitMaskContour.setAttribute('href', `#${c._fitGlyphId}`);

    const url = `url("#${c._fitMaskId}")`;
    host.style.maskImage = url;
    host.style.webkitMaskImage = url;
    return true;
  }

  /** Monotonic, so a test can see the reference move rather than guess. */
  nextMaskId() {
    const c = this.chamber;
    c._fitMaskTurn = (c._fitMaskTurn || 0) + 1;
    return `${c._fitMaskSeed}-${c._fitMaskTurn}`;
  }

  reveal(atomDisplay, host) {
    host.classList.remove('is-hidden');
    this.chamber._fitMaskSvg?.classList.add('is-ready');
    atomDisplay.classList.add('is-mask-ink', 'is-mask-ready');
    atomDisplay.dataset.maskState = 'ready';
    atomDisplay.style.color = 'transparent';
    atomDisplay.style.removeProperty('text-shadow');
    this.syncGround();
  }

  destroyField() {
    const c = this.chamber;
    c._fillMaskGeneration += 1;
    const atomDisplay = c.container.querySelector('#atom-display');
    atomDisplay?.classList.remove('is-mask-ink', 'is-mask-ready');
    if (atomDisplay) atomDisplay.dataset.maskState = 'inactive';
    if (atomDisplay?.style.color === 'transparent') {
      atomDisplay.style.removeProperty('color');
    }
    visualCortex.setContinuousFieldProjectionHost(null);
    c.fillViewport = null;
    if (c.fillFieldHost) {
      c.fillFieldHost.remove();
      c.fillFieldHost = null;
    }
    if (c._fitMaskSvg) {
      c._fitMaskSvg.remove();
      c._fitMaskSvg = null;
      c._fitMaskMask = null;
      c._fitMaskText = null;
      c._fitMaskUse = null;
      c._fitMaskContour = null;
      c._fitGlyphId = null;
      // The live reference goes with the node it named. The seed and the turn
      // stay, so a remounted mask cannot reuse an id a stale rule may hold.
      c._fitMaskId = null;
      c._fitMaskSignature = null;
    }
    this.removeGroundPlate();
  }
}
