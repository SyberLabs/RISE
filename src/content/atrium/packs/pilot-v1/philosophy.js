import { PHILOSOPHY_ARISTOTLE_PAYLOADS } from './philosophy-aristotle.js';
import { PHILOSOPHY_CLASSICAL_PAYLOADS } from './philosophy-classical.js';
import { PHILOSOPHY_TRANSMISSION_PAYLOADS } from './philosophy-transmission.js';

export const PHILOSOPHY_PILOT_PAYLOADS = Object.freeze({
  ...PHILOSOPHY_CLASSICAL_PAYLOADS,
  ...PHILOSOPHY_ARISTOTLE_PAYLOADS,
  ...PHILOSOPHY_TRANSMISSION_PAYLOADS
});
