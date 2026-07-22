/**
 * LiturgyRunner — the first choreography object.
 *
 * A liturgy is an ordered list of FIXED steps, each a (text,
 * repetition-count, focal-state) triple with a fixed duration. The
 * runner compiles a liturgy definition into a flat step sequence and
 * exposes position state (which step, which bead, which decade) for
 * surfaces like the bead strand.
 *
 * Non-negotiable #3 lives here structurally: there is NO randomness,
 * NO semantic track, NO probabilistic selection anywhere in this
 * module. The same definition compiles to the same steps, every time.
 * The conductor's cleverness stays outside the fixed forms.
 *
 * Built general (spec §4): the Rosary is the first instance; the
 * Stations (§5) and future offices reuse the same shape.
 */

/**
 * @typedef {Object} LiturgyStep
 * @property {string} id           - stable step id (e.g. 'decade-2-hail-7')
 * @property {string} text         - the step's spoken/displayed text
 * @property {number} durationMs   - fixed duration at 1.0× pace
 * @property {Object} state        - choreography state for surfaces:
 *   { bead: number|null, decade: number|null, mystery: object|null,
 *     phase: string }
 */

/**
 * Compile a liturgy definition into fixed steps.
 *
 * Definition shape: { id, title, steps: [{ id, text, durationMs,
 * repeat?, state? }] } — repeat expands into N steps with ordinal
 * suffixes and per-repetition state (repetition index exposed as
 * state.repetition, 1-based).
 *
 * @param {Object} definition
 * @param {Object} [options] - { paceMultiplier } global multiplier ≥ 0.25
 * @returns {{ id, title, steps: LiturgyStep[], totalDurationMs }}
 */
export function compileLiturgy(definition, options = {}) {
  if (!definition || !Array.isArray(definition.steps)) {
    throw new TypeError('A liturgy definition requires an ordered steps array.');
  }
  const pace = Number.isFinite(options.paceMultiplier) && options.paceMultiplier > 0
    ? Math.max(0.25, Math.min(4, options.paceMultiplier))
    : 1;

  const steps = [];
  for (const step of definition.steps) {
    if (typeof step?.text !== 'string' || !step.text.trim()) {
      throw new TypeError(`Liturgy step ${step?.id ?? '(unnamed)'} has no text.`);
    }
    if (!Number.isFinite(step.durationMs) || step.durationMs <= 0) {
      throw new TypeError(`Liturgy step ${step.id} has no fixed duration.`);
    }
    const repeat = Number.isInteger(step.repeat) && step.repeat > 1 ? step.repeat : 1;
    for (let repetition = 1; repetition <= repeat; repetition += 1) {
      steps.push({
        id: repeat > 1 ? `${step.id}-${repetition}` : step.id,
        text: step.text,
        durationMs: Math.round(step.durationMs / pace),
        state: {
          // A GENERAL runner: every liturgy's own state fields pass
          // through (the Rosary's decade/mystery, the Stations'
          // station) — the first draft whitelisted rosary fields and
          // silently dropped the Stations' `station`.
          ...(step.state && typeof step.state === 'object' ? step.state : {}),
          phase: step.state?.phase ?? 'prayer',
          decade: step.state?.decade ?? null,
          mystery: step.state?.mystery ?? null,
          // bead advances per repetition when the step spans beads
          bead: step.state?.beadStart != null
            ? step.state.beadStart + (repetition - 1)
            : step.state?.bead ?? null,
          repetition: repeat > 1 ? repetition : null,
          repeatTotal: repeat > 1 ? repeat : null
        }
      });
    }
  }

  return {
    id: definition.id,
    title: definition.title,
    steps,
    totalDurationMs: steps.reduce((sum, step) => sum + step.durationMs, 0)
  };
}

/**
 * Compile liturgy steps into playable session atoms.
 *
 * A liturgy does not chunk: each step IS one atom, timing-locked at
 * its fixed duration so the player's pacing curve leaves it alone.
 * The step id rides in tags as `liturgy:<stepId>` so surfaces (the
 * bead strand) can read choreography state per displayed atom.
 *
 * @param {Object} compiled - result of compileLiturgy
 * @param {Object} AtomClass - the session Atom class (injected to keep
 *   this module dependency-light and testable)
 * @returns {Object[]} atoms
 */
export function liturgyToAtoms(compiled, AtomClass) {
  return compiled.steps.map((step, index) => new AtomClass({
    content: step.text,
    modality: 'text',
    duration: step.durationMs,
    weight: 0.5,
    tags: [`liturgy:${step.id}`, `liturgy-phase:${step.state.phase}`],
    source: compiled.title,
    sourceId: compiled.id,
    position: index,
    phase: step.state.phase,
    timingLocked: true
  }));
}

/** Look up a compiled step's state by its id. */
export function liturgyStepState(compiled, stepId) {
  return compiled.steps.find(step => step.id === stepId)?.state ?? null;
}

/** Read the liturgy step id off a playing atom's tags, or null. */
export function liturgyStepIdFromAtom(atom) {
  const tag = (atom?.tags || []).find(entry => entry.startsWith('liturgy:'));
  return tag ? tag.slice('liturgy:'.length) : null;
}
