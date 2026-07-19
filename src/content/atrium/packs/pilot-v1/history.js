import { HISTORY_ATLANTIC_PAYLOADS } from './history-atlantic.js';
import { HISTORY_CONSTITUTION_PAYLOADS } from './history-constitutions.js';
import { HISTORY_REVOLUTION_PAYLOADS } from './history-revolutions.js';

export const HISTORY_PILOT_PAYLOADS = Object.freeze({
  ...HISTORY_REVOLUTION_PAYLOADS,
  ...HISTORY_CONSTITUTION_PAYLOADS,
  ...HISTORY_ATLANTIC_PAYLOADS
});
