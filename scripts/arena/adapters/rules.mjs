// Two deciders with no model, built only from code RISE already ships.
//
// rules        a named book wins, else the turn's focus book; every other
//              question goes to the option whose id and description share the
//              most words with the intent (id words count 3, description words
//              1, as the sound shortlist ranks sounds). Ties go to the first key.
// rules-floor  the first offered option for every question.
import { soundWords } from '../../../src/core/decision/recommend.js';
import { namesCatalogEntry } from '../../../src/core/decision/variance.js';

const ZERO = { servedModel: null, usage: null, costUsd: 0, costSource: 'zero', probabilities: null };
const NO_PRICE = { source: 'none: no model', asOf: null };

export function rulesAnswers(body, intent, hints) {
  const intentWords = new Set(soundWords(intent));
  const overlap = text => soundWords(text).filter(word => intentWords.has(word)).length;
  const answers = {};
  for (const [name, question] of Object.entries(body.questions)) {
    const keys = Object.keys(question.criteria);
    let choice = keys[0];
    if (name === 'book') {
      choice = hints.eligibleBooks.find(book => namesCatalogEntry(intent, [book]))?.work_id
        ?? hints.variation.focusWorkId ?? choice;
    } else {
      let best = -1;
      for (const [value, description] of Object.entries(question.criteria)) {
        const score = 3 * overlap(value.replaceAll('-', ' ')) + overlap(description);
        if (score > best) { best = score; choice = value; }
      }
    }
    answers[name] = { type: 'choice', choice };
  }
  return answers;
}

export function floorAnswers(body) {
  return Object.fromEntries(Object.entries(body.questions).map(([name, question]) =>
    [name, { type: 'choice', choice: Object.keys(question.criteria)[0] }]));
}

export const rulesDecider = () => ({
  id: 'rules', requestedModel: null, revision: null, pricing: NO_PRICE, estimateUsd: () => 0,
  decide: async ({ body, intent, hints }) => ({ ...ZERO, answers: rulesAnswers(body, intent, hints) })
});

export const rulesFloorDecider = () => ({
  id: 'rules-floor', requestedModel: null, revision: null, pricing: NO_PRICE, estimateUsd: () => 0,
  decide: async ({ body }) => ({ ...ZERO, answers: floorAnswers(body) })
});
