import { freezeManifest } from './constants.js';
import { HISTORY_CORPUS } from './history.js';
import { PHILOSOPHY_CORPUS } from './philosophy.js';

export const ATRIUM_EDITORIAL_ECHOES = freezeManifest([
  {
    id: 'echo-stoa-rights-man',
    fromDomain: 'philosophy',
    fromId: 'ph-tradition-roman-stoa',
    toDomain: 'history',
    toId: 'hist-rights-man',
    label: 'A later language of universal standing',
    note: 'A comparative reading prompt about moral standing and universal claims; it does not assert direct transmission.',
    confidence: 'high',
    editorialStage: 'editorial',
    citationRefs: ['SEP-STOICISM', 'FRDA'],
    status: 'reviewed'
  },
  {
    id: 'echo-cynicism-rights-woman',
    fromDomain: 'philosophy',
    fromId: 'ph-school-cynicism',
    toDomain: 'history',
    toId: 'hist-rights-woman',
    label: 'Convention tested by frank speech',
    note: 'A thematic juxtaposition of convention, exclusion, and public challenge; it does not assert a historical lineage.',
    confidence: 'high',
    editorialStage: 'editorial',
    citationRefs: ['SEP-CYN', 'GALLICA'],
    status: 'reviewed'
  },
  {
    id: 'echo-aristotle-constitution',
    fromDomain: 'philosophy',
    fromId: 'ph-thinker-aristotle',
    toDomain: 'history',
    toId: 'hist-us-constitution',
    label: 'Constitutions as objects of inquiry',
    note: 'A cross-domain invitation to compare constitutional analysis and constitutional design, without claiming direct influence.',
    confidence: 'high',
    editorialStage: 'editorial',
    citationRefs: ['SEP-ARISTOTLE', 'NARA'],
    status: 'reviewed'
  }
]);

export function echoesFor(domain, recordId) {
  return ATRIUM_EDITORIAL_ECHOES.filter(echo => echo.status === 'reviewed' && (
    (echo.fromDomain === domain && echo.fromId === recordId)
    || (echo.toDomain === domain && echo.toId === recordId)
  ));
}

export function echoDestination(echo, domain) {
  return echo.fromDomain === domain
    ? { domain: echo.toDomain, id: echo.toId }
    : { domain: echo.fromDomain, id: echo.fromId };
}

export function validateAtriumEchoes(echoes = ATRIUM_EDITORIAL_ECHOES) {
  const philosophyIds = new Set(PHILOSOPHY_CORPUS.nodes.map(record => record.id));
  const historyIds = new Set(HISTORY_CORPUS.events.map(record => record.id));
  const ids = new Set();
  const errors = [];
  echoes.forEach(echo => {
    if (ids.has(echo.id)) errors.push({ code: 'duplicate-echo', recordId: echo.id });
    ids.add(echo.id);
    if (!philosophyIds.has(echo.fromId) || !historyIds.has(echo.toId)) {
      errors.push({ code: 'dangling-echo', recordId: echo.id });
    }
    if (echo.fromDomain !== 'philosophy' || echo.toDomain !== 'history') {
      errors.push({ code: 'invalid-echo-domain', recordId: echo.id });
    }
    if (echo.status === 'reviewed' && (echo.editorialStage !== 'editorial'
      || echo.confidence !== 'high'
      || !Array.isArray(echo.citationRefs)
      || echo.citationRefs.length < 2)) {
      errors.push({ code: 'unreviewed-echo-claim', recordId: echo.id });
    }
  });
  return { valid: errors.length === 0, errors };
}
