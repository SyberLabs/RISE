import { PHILOSOPHY_ARISTOTLE_PAYLOADS } from './philosophy-aristotle.js';
import { PHILOSOPHY_CLASSICAL_PAYLOADS } from './philosophy-classical.js';
import { PHILOSOPHY_TRANSMISSION_PAYLOADS } from './philosophy-transmission.js';
import { PHILOSOPHY_EXPANSION_A } from './expanded-philosophy-a.js';
import { PHILOSOPHY_EXPANSION_B } from './expanded-philosophy-b.js';
import { PHILOSOPHY_EXPANSION_C } from './expanded-philosophy-c.js';
import { PHILOSOPHY_EXPANSION_D } from './expanded-philosophy-d.js';
import { PHILOSOPHY_EXPANSION_E } from './expanded-philosophy-e.js';
import { PHILOSOPHY_EXPANSION_F } from './expanded-philosophy-f.js';
import { PHILOSOPHY_EXPANSION_G } from './expanded-philosophy-g.js';
import { PHILOSOPHY_EXPANSION_H } from './expanded-philosophy-h.js';

export const PHILOSOPHY_PILOT_PAYLOADS = Object.freeze({
  ...PHILOSOPHY_CLASSICAL_PAYLOADS,
  ...PHILOSOPHY_ARISTOTLE_PAYLOADS,
  ...PHILOSOPHY_TRANSMISSION_PAYLOADS,
  ...PHILOSOPHY_EXPANSION_A,
  ...PHILOSOPHY_EXPANSION_B,
  ...PHILOSOPHY_EXPANSION_C,
  ...PHILOSOPHY_EXPANSION_D,
  ...PHILOSOPHY_EXPANSION_E,
  ...PHILOSOPHY_EXPANSION_F,
  ...PHILOSOPHY_EXPANSION_G,
  ...PHILOSOPHY_EXPANSION_H
});
