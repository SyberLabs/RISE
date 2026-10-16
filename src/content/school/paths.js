/**
 * The five reading paths of the owner's plan: one question followed across
 * houses. A step names a canon record and, where the plan assigns only part of
 * the text, that part in the plan's words; `part` is otherwise null.
 * `question` is the plan's subtitle, null where the plan gives none.
 */

const freeze = Object.freeze;

function path(id, name, question, steps) {
  return freeze({
    id, name, question,
    steps: freeze(steps.map(([record, part = null]) => freeze({ record, part })))
  });
}

export const SCHOOL_PATHS = freeze([
  path('ficino', 'The Ficino Path', 'how a renaissance happens', [
    ['gate.oration'],
    ['saturn.corpus-hermeticum', 'Poimandres'],
    ['sun.enneads', 'I.6, On Beauty'],
    ['mars.renaissance-in-italy', 'Part II'],
    ['venus.spiritual-in-art']
  ]),
  path('ghosts', 'Ghosts in the Machine', 'mind meets mechanism', [
    ['sun.monadology', 'the mill passage, section 17'],
    ['mercury.ninth-bridgewater'],
    ['mercury.lovelace-notes'],
    ['mercury.on-governors'],
    ['mercury.book-of-the-machines'],
    ['mercury.machine-stops'],
    ['moon.stream-of-thought']
  ]),
  path('form', 'Form and Becoming', 'the generative path', [
    ['sun.fragments'],
    ['jupiter.metamorphosis-of-plants'],
    ['jupiter.art-forms-in-nature'],
    ['jupiter.growth-and-form'],
    ['moon.matter-and-memory'],
    ['venus.spiritual-in-art']
  ]),
  path('unsaid', 'The Unsaid', 'the apophatic path', [
    ['saturn.tao-te-ching'],
    ['saturn.zhuangzi'],
    ['saturn.mystical-theology'],
    ['saturn.cloud-of-unknowing'],
    ['saturn.sermons']
  ]),
  path('seasons', 'The Seasons of Civilization', null, [
    ['mars.peloponnesian-war', 'the Melian Dialogue'],
    ['mars.muqaddimah'],
    ['mars.new-science'],
    ['mars.renaissance-in-italy'],
    ['mars.decline-of-the-west', 'vol. I'],
    ['mars.golden-bough']
  ])
]);
