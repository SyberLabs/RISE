import { validateVisualCommand } from '../core/visual-control-contract.js';

/**
 * Exclusive lifecycle owner for schedulable persistent visual fields.
 *
 * The generic visual scheduler decides *which* cue is active. This director
 * owns the expensive DOM/rendering state needed by field cues and guarantees
 * that a successor retires its predecessor exactly once. Collection, video,
 * procedural, and still cues clear the field without learning how a field is
 * rendered.
 */
export class VisualFieldDirector {
  constructor({ mount, transitionMs = 320, scheduleFrame } = {}) {
    this.mount = typeof mount === 'function' ? mount : () => null;
    this.transitionMs = Math.max(0, Math.min(Number(transitionMs) || 0, 2000));
    this.scheduleFrame = typeof scheduleFrame === 'function'
      ? scheduleFrame
      : (callback) => (typeof requestAnimationFrame === 'function'
          ? requestAnimationFrame(callback)
          : setTimeout(callback, 0));
    this.active = null;
    this.retiring = new Set();
    this.timers = new Map();
    this.generation = 0;
    this.paused = false;
    this.destroyed = false;
  }

  applyCue(cue, { transitionMs = this.transitionMs } = {}) {
    const transition = Math.max(0, Math.min(Number(transitionMs) || 0, 2000));
    if (cue?.kind !== 'field') {
      this.clear({ transitionMs: transition });
      return false;
    }
    const key = JSON.stringify([cue.renderer, cue.config || {}]);
    if (this.active?.key === key) {
      this.active.cancelVisualControl?.();
      return true;
    }
    // A field that can reach its successor by interpolation keeps its layer:
    // compatible Living Flame recipes morph rather than crossfade.
    if (this.active && this.active.renderer === cue.renderer
      && typeof this.active.morph === 'function'
      && this.active.morph(cue, { transitionMs: transition }) === true) {
      this.active.key = key;
      return true;
    }

    const generation = ++this.generation;
    const record = this.mount(cue, { generation });
    if (!record || typeof record.destroy !== 'function') {
      this.clear();
      return false;
    }
    record.key = key;
    record.generation = generation;
    const previous = this.active;
    this.active = record;
    if (this.paused) record.pause?.();

    const node = record.node;
    node?.classList?.add('chamber-scheduled-field');
    node?.style?.setProperty('transition-duration', `${transition}ms`);
    this.scheduleFrame(() => {
      if (this.active === record && record.generation === this.generation) {
        node?.classList?.add('is-active');
      }
    });
    if (previous) this.retire(previous, false, transition);
    return true;
  }

  clear({ immediate = false, transitionMs = this.transitionMs } = {}) {
    this.generation += 1;
    const previous = this.active;
    this.active = null;
    if (previous) this.retire(previous, immediate, transitionMs);
    return !!previous;
  }

  discoverVisual() {
    const record = this.active;
    if (this.destroyed || !record || record.generation !== this.generation
      || record.node?.isConnected === false || typeof record.discoverVisual !== 'function'
      || typeof record.controlVisual !== 'function') return null;
    return record.discoverVisual();
  }

  controlVisual(command) {
    const record = this.active;
    // The active field's own manifest bounds the command; a record that names none is held to the attractor's.
    const manifest = typeof record?.discoverVisual === 'function' ? record.discoverVisual()?.manifest : null;
    const validated = validateVisualCommand(command, manifest?.parameters ? manifest : undefined);
    if (!validated.ok) return { status: 'refused', code: validated.code };
    if (this.destroyed || !record || record.generation !== this.generation
      || record.node?.isConnected === false) {
      return { status: 'refused', code: 'NO_ACTIVE_VISUAL' };
    }
    if (typeof record.controlVisual !== 'function') {
      return { status: 'refused', code: 'UNSUPPORTED_SURFACE' };
    }
    return record.controlVisual(command);
  }

  retire(record, immediate = false, transitionMs = this.transitionMs) {
    if (!record || this.retiring.has(record)) return;
    record.cancelVisualControl?.();
    // At most two layers: the incoming field and one outgoing field. An
    // older layer still fading out is disposed now rather than stacking.
    [...this.retiring].forEach(previous => this.dispose(previous));
    record.node?.classList?.remove('is-active');
    record.node?.classList?.add('is-leaving');
    const transition = Math.max(0, Math.min(Number(transitionMs) || 0, 2000));
    record.node?.style?.setProperty('transition-duration', `${transition}ms`);
    if (immediate || transition === 0) {
      this.dispose(record);
      return;
    }
    this.retiring.add(record);
    const timer = setTimeout(() => this.dispose(record), transition);
    this.timers.set(record, timer);
  }

  dispose(record) {
    const timer = this.timers.get(record);
    if (timer) clearTimeout(timer);
    this.timers.delete(record);
    this.retiring.delete(record);
    record.destroy();
  }

  pause() {
    this.paused = true;
    this.active?.pause?.();
    this.retiring.forEach(record => record.pause?.());
  }

  resume() {
    this.paused = false;
    this.active?.resume?.();
    this.retiring.forEach(record => record.resume?.());
  }

  destroy() {
    this.destroyed = true;
    this.generation += 1;
    if (this.active) this.dispose(this.active);
    this.active = null;
    [...this.retiring].forEach(record => this.dispose(record));
    this.retiring.clear();
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  }
}
