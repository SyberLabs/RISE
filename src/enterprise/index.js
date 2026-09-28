/**
 * EnterpRise, narrow first version.
 *
 * Prepared talk, speaker rail, one presenter. The public exports are the
 * ingest, the program, the session, and the rail.
 */

export { ingestCorpus } from './corpus.js';
export { EnterpriseError } from './errors.js';
export { prepareTalk } from './prepare.js';
export { openSession } from './session.js';
export { renderRail } from './rail-view.js';
export { renderStage } from './stage-view.js';
export { renderChart } from './chart.js';
