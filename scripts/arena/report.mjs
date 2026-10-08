// Scores re-derived from a run's results, deterministically: the same run file
// and the same fixtures always print the same bytes. Scores are "agreement with
// author-written expectations", not accuracy; the cases were tuned on Jev.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildRecommendRequest } from '../../src/core/decision/recommend.js';
import { scoreDecisions } from '../jev-eval.mjs';
import { sha256Hex } from './arena-file.mjs';

// Option fields in the fixtures that name a different question.
const QUESTION_OF = Object.freeze({ visualMode: 'visual', chunkMode: 'chunk', revealMode: 'reveal' });

// calibration.mjs arrives with #531. A run records the version of it that
// scored the run (the first twelve hex digits of its bytes' SHA-256); a run
// without one is never given calibration, so older runs still reproduce.
const CALIBRATION = fileURLToPath(new URL('./calibration.mjs', import.meta.url));
const calibrationModule = existsSync(CALIBRATION) ? await import(CALIBRATION) : null;
export const CALIBRATION_VERSION = calibrationModule ? sha256Hex(readFileSync(CALIBRATION)).slice(0, 12) : null;
export const calibration = calibrationModule?.calibration;

/** Each fixture case's `expect` as {question: acceptable choices}. */
export const expectedChoices = item => Object.fromEntries(Object.entries(item.expect || {})
  .map(([field, acceptable]) => [QUESTION_OF[field] || field, acceptable]));

/**
 * calibration()'s rows: one per result and question that has an acceptable
 * set, carrying the decider's raw choice, its probabilities and confidence.
 * @param acceptableOf caseId → {question: acceptable choices}
 */
export function calibrationRows(results, acceptableOf) {
  const rows = [];
  for (const row of results) {
    if (!row.rawAnswers) continue;
    for (const [question, acceptable] of Object.entries(acceptableOf(row.caseId) || {})) {
      const answer = row.rawAnswers[question];
      rows.push({ caseId: row.caseId, providerId: row.providerId, run: row.run, question,
        probabilities: row.probabilities?.[question] ?? null, confidence: answer?.confidence ?? null,
        choice: answer?.type === 'choice' ? answer.choice : null, acceptable });
    }
  }
  return rows;
}

/** The choice made for each question, or the answer's type when it is not a choice. */
const choices = row => row.rawAnswers && Object.fromEntries(Object.keys(row.rawAnswers).sort()
  .map(name => [name, row.rawAnswers[name].type === 'choice' ? row.rawAnswers[name].choice : row.rawAnswers[name].type]));

const round = (value, places = 6) => Math.round(value * 10 ** places) / 10 ** places;

function percentile(sorted, p) {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] : null;
}

/** Question-level audit of one row's raw answers against the menu it was offered. */
function audit(row, questions) {
  const counts = { outOfMenu: 0, missing: 0, refusals: 0 };
  if (!row.rawAnswers) return { valid: false, counts };
  for (const [name, question] of Object.entries(questions)) {
    const answer = row.rawAnswers[name];
    if (!answer) counts.missing++;
    else if (answer.type === 'refusal') counts.refusals++;
    else if (answer.type !== 'choice' || !Object.hasOwn(question.criteria, answer.choice)) counts.outOfMenu++;
  }
  return { valid: !counts.outOfMenu && !counts.missing && !counts.refusals, counts };
}

function rawDecision(row, options) {
  return Object.fromEntries(Object.keys(options).map(field =>
    [field, row.rawAnswers?.[QUESTION_OF[field] || field]?.choice ?? null]));
}

function admittedDecision(row, options) {
  const config = row.admitted.config;
  return Object.fromEntries(Object.keys(options).map(field =>
    [field, field === 'pace' ? String(config.wpm) : config[field]]));
}

/** @returns scores keyed by provider id, in the run's provider order */
export function scoreRun(run, { cases, controls = [], options, catalog }) {
  const questions = new Map([...cases, ...controls].map(item => [item.id, buildRecommendRequest({
    intent: item.intent, catalog, turn: 0, nightDrive: false }).body.questions]));
  const expected = new Map(cases.map(item => [item.id, expectedChoices(item)]));
  const calibrated = run.calibrationVersion && calibration
    ? calibration(calibrationRows(run.results, id => expected.get(id))) : null;
  const scores = {};
  for (const { id } of run.providers) {
    const rows = run.results.filter(row => row.providerId === id)
      .sort((a, b) => a.run - b.run);
    const counts = { outOfMenu: 0, missing: 0, refusals: 0 };
    const rawRows = [];
    const admittedRows = [];
    let rawValid = 0;
    for (const row of rows) {
      const result = audit(row, questions.get(row.caseId));
      for (const key of Object.keys(counts)) counts[key] += result.counts[key];
      if (result.valid) rawValid++;
      rawRows.push(result.valid ? { id: row.caseId, decision: rawDecision(row, options),
        workId: row.rawAnswers.book?.choice } : { id: row.caseId });
      admittedRows.push(row.admitted ? { id: row.caseId, decision: admittedDecision(row, options),
        workId: row.admitted.workId } : { id: row.caseId });
    }
    const raw = scoreDecisions(cases, rawRows, options);
    const admitted = scoreDecisions(cases, admittedRows, options);
    const byCase = new Map();
    for (const row of rows) byCase.set(row.caseId, [...(byCase.get(row.caseId) || []), row]);
    const repeated = [...byCase.values()].filter(group => group.length > 1);
    const same = (group, pick) => group.every(row => JSON.stringify(pick(row)) === JSON.stringify(pick(group[0])));
    const latencies = rows.map(row => row.latencyMs).filter(Number.isFinite).sort((a, b) => a - b);
    const costs = rows.map(row => row.costUsd).filter(Number.isFinite);
    const total = costs.reduce((sum, value) => sum + value, 0);
    scores[id] = {
      results: rows.length,
      errors: rows.filter(row => !row.rawAnswers).length,
      valid: { raw: rawValid, admitted: rows.filter(row => row.admitted).length },
      ...counts,
      explicit: { raw: raw.explicit, admitted: admitted.explicit },
      contrast: { raw: raw.contrast, admitted: admitted.contrast },
      stability: {
        cases: repeated.length,
        identicalRaw: repeated.filter(group => same(group, choices)).length,
        identicalAdmitted: repeated.filter(group => same(group, row => row.admitted)).length
      },
      latencyMs: { p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95) },
      cost: { totalUsd: round(total), per1kUsd: costs.length ? round(total / costs.length * 1000) : null,
        unreported: rows.length - costs.length },
      ...(calibrated ? { calibration: calibrated[id] ?? null } : {})
    };
  }
  return scores;
}
