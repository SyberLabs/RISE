import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scoreDecisions } from './jev-eval.mjs';
import { JEV_AUDIO_IDS } from '../src/core/jev-config.js';

const cases = [
  { id: 'quiet', intent: 'Quiet reading', group: 'energy', expect: { pace: ['100', '150'], audio: ['silent'] } },
  { id: 'loud', intent: 'Fast reading', group: 'energy', expect: { pace: ['300', '400'], audio: ['aurora'] } }
];

test('scores explicit matches, pair contrast, choices, and known usage', () => {
  const result = scoreDecisions(cases, [
    { id: 'quiet', decision: { pace: '150', audio: 'silent' }, usage: { prompt_tokens: 10, completion_tokens: 5 } },
    { id: 'loud', decision: { pace: '300', audio: 'aurora' }, usage: { prompt_tokens: 12, completion_tokens: 6 } }
  ], { pace: ['100', '150', '300', '400'], audio: ['silent', 'aurora'] });
  assert.equal(result.explicit.passed, 4);
  assert.equal(result.explicit.total, 4);
  assert.equal(result.contrast.passed, 1);
  assert.equal(result.contrast.total, 1);
  assert.equal(result.invalid, 0);
  assert.deepEqual(result.unique, { pace: 2, audio: 2 });
  assert.deepEqual(result.usage, { promptTokens: 22, completionTokens: 11, unreported: 0 });
});

test('counts malformed, missing, and disallowed answers as failures without inventing usage', () => {
  const result = scoreDecisions(cases, [
    { id: 'quiet', decision: { pace: '999', audio: 'silent' } },
    { id: 'loud', error: 'timeout' }
  ], { pace: ['100', '150', '300', '400'], audio: ['silent', 'aurora'] });
  assert.equal(result.invalid, 2);
  assert.equal(result.explicit.passed, 0);
  assert.equal(result.explicit.total, 4);
  assert.equal(result.contrast.passed, 0);
  assert.equal(result.usage.unreported, 2);
});

test('evaluation set has paired, valid, explicit choices on every requested axis', () => {
  const fixtures = JSON.parse(readFileSync(new URL('./jev-eval-cases.json', import.meta.url)));
  const options = JSON.parse(readFileSync(new URL('./jev-eval-options-candidate.json', import.meta.url)));
  assert.equal(fixtures.length, 39);
  assert.equal(options.chamberFace.length, 7);
  assert.equal(options.fontSize.length, 5);
  assert.deepEqual(options.audio, ['silent', ...JEV_AUDIO_IDS]);
  const groups = new Map();
  const axes = new Set();
  for (const fixture of fixtures) {
    assert.ok(fixture.id && fixture.intent);
    if (fixture.group) groups.set(fixture.group, (groups.get(fixture.group) || 0) + 1);
    for (const [key, values] of Object.entries(fixture.expect)) {
      axes.add(key);
      assert.ok(values.length && values.every(value => options[key]?.includes(value)));
    }
  }
  assert.ok([...groups.values()].every(count => count === 2));
  assert.deepEqual([...axes].sort(), Object.keys(options).sort());
  const coveredSounds = new Set(fixtures.flatMap(fixture => fixture.expect.audio || []));
  assert.ok(JEV_AUDIO_IDS.every(sound => coveredSounds.has(sound)));
  assert.ok(['sans', 'book'].every(face => options.chamberFace.includes(face)
    && fixtures.some(fixture => fixture.expect.chamberFace?.includes(face))));
  assert.ok(options.fontSize.includes('xlarge')
    && fixtures.some(fixture => fixture.expect.fontSize?.includes('xlarge')));
  const byId = new Map(fixtures.map(fixture => [fixture.id, fixture]));
  assert.ok(byId.get('book-serif').expect.chamberFace.includes('book'));
  assert.ok(byId.get('large').expect.fontSize.includes('xlarge'));
  assert.ok(['lullaby', 'nocturne', 'starlight'].every(sound =>
    byId.get('soundscape').expect.audio.includes(sound)));
  assert.ok(byId.get('soundscape').expect.audio.length < options.audio.length);
});

test('rejects unexpected answer keys', () => {
  const result = scoreDecisions([cases[0]], [
    { id: 'quiet', decision: { pace: '150', audio: 'silent', explanation: 'because' } }
  ], { pace: ['150'], audio: ['silent'] });
  assert.equal(result.invalid, 1);
});

test('look evaluation covers independent colors, type, audio, and visuals in contrast pairs', () => {
  const fixtures = JSON.parse(readFileSync(new URL('./jev-eval-look-cases.json', import.meta.url)));
  const options = JSON.parse(readFileSync(new URL('./jev-eval-look-options.json', import.meta.url)));
  assert.equal(fixtures.length, 8);
  assert.deepEqual(fixtures.map(item => item.group),
    ['ink', 'ink', 'ground', 'ground', 'type', 'type', 'senses', 'senses']);
  for (const item of fixtures) {
    for (const [axis, values] of Object.entries(item.expect)) {
      assert.ok(values.length && values.every(value => options[axis]?.includes(value)));
    }
  }
});
