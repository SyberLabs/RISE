/**
 * The Rosary -> Chamber handoff.
 *
 * Compiles the fixed liturgy (rosary-liturgy.js through the
 * LiturgyRunner) into a playable session. Unlike text handoffs this
 * carries PRE-BUILT timing-locked atoms — a liturgy does not chunk;
 * each prayer step is one atom at recitation pace.
 *
 * Focal: the Marian icon by default (spec §4: "the Marian icon holds
 * the focal throughout"); the reader's chosen Chapel icon wins if
 * they picked one — the icon choice is a deliberate act and the
 * Rosary honors it.
 *
 * Sound: silence by default (spec §3: "the Rosary and Stations may
 * run in silence by design. Chant is offered, never imposed").
 *
 * Imagery: Plain mode shows the icon only. Imagistic mode adds ONE
 * pinned work per mystery, held as a still for the decade's duration
 * — pinned works, not rotation; the mapping lives in
 * rosary-imagery.js and is empty until curated.
 */

import { compileLiturgy, liturgyToAtoms } from '../../../core/liturgy-runner.js';
import { buildRosaryDefinition } from './rosary-liturgy.js';
import { MYSTERY_SETS } from './rosary.js';
import { CHAPEL_ICON_DEFAULTS, findChapelIcon } from '../imagery/icons.js';
import { Atom } from '../../../core/models.js';

/**
 * @param {string} setId - a MYSTERY_SETS id
 * @param {Object} [options]
 *   - mode: 'plain' | 'imagistic'
 *   - iconId: the reader's chosen Chapel icon (wins over the Marian default)
 *   - paceMultiplier: global pace, default 1
 * @returns {Object} chamber session data { atoms-ready config }
 */
export function createRosaryHandoff(setId, options = {}) {
  const set = MYSTERY_SETS[setId];
  if (!set) throw new RangeError(`Unknown mystery set: ${String(setId)}`);

  const mode = options.mode === 'imagistic' ? 'imagistic' : 'plain';
  const chosen = options.iconId && findChapelIcon(options.iconId) ? options.iconId : null;
  const iconId = chosen || CHAPEL_ICON_DEFAULTS.marian;

  const compiled = compileLiturgy(buildRosaryDefinition(setId), {
    paceMultiplier: options.paceMultiplier
  });
  const atoms = liturgyToAtoms(compiled, Atom);

  return {
    liturgy: compiled,
    session: {
      id: crypto.randomUUID(),
      title: compiled.title,
      atoms,
      atomCount: atoms.length,
      totalDuration: compiled.totalDurationMs,
      sources: [{
        id: compiled.id,
        name: compiled.title,
        type: 'liturgy',
        providerId: 'chapel-liturgy',
        provenance: {
          kind: 'chapel-liturgy',
          liturgyId: compiled.id,
          mysterySet: set.id,
          mode,
          attribution: 'The Holy Rosary — traditional form, public domain'
        }
      }],
      visualConfig: {
        visualMode: 'focals',
        focals: { type: 'icon', iconId },
        // The Chamber reads these to drive the strand and the stills
        liturgy: {
          kind: 'rosary',
          mysterySet: set.id,
          mode
        }
      },
      soundscape: 'none',
      origin: {
        view: 'chapel',
        icon: '✛',
        name: 'Chapel',
        data: {}
      },
      provenance: {
        kind: 'chapel-liturgy',
        liturgyId: compiled.id,
        mysterySet: set.id,
        mode
      }
    }
  };
}
