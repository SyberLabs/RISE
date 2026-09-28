import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validReleaseDecision } from './verify-decision-identity.mjs';

const revision = '139fdd94f1b6a6ad80cc15e08fcb99cac885a101';
const kev = { provider: 'Kev', model: 'kev-latest', revision };

test('release verification requires the configured Kev identity', () => {
  assert.equal(validReleaseDecision(kev, { KEV_REVISION: revision }), true);
  for (const result of [null, { ...kev, provider: undefined },
    { ...kev, model: 'typesafe/jev-1.13' }, { ...kev, revision: 'b'.repeat(40) }]) {
    assert.equal(validReleaseDecision(result, { KEV_REVISION: revision }), false);
  }
  for (const env of [{}, { KEV_REVISION: 'main' },
    { KEV_REVISION: revision, KEV_MODEL: 'other' },
    { KEV_REVISION: revision, DECISION_PROVIDER: 'unknown' }]) {
    assert.equal(validReleaseDecision(kev, env), false);
  }
});

test('release verification accepts Jev only with explicit rollback', () => {
  for (const model of ['typesafe/jev-1.13', 'typesafe/jev-1.13-20260917']) {
    assert.equal(validReleaseDecision({ model }, { DECISION_PROVIDER: 'jev' }), true);
    assert.equal(validReleaseDecision({ model }, { KEV_REVISION: revision }), false);
  }
  assert.equal(validReleaseDecision(kev, { DECISION_PROVIDER: 'jev' }), false);
  assert.equal(validReleaseDecision({ model: 'typesafe/jev-1.13-other' },
    { DECISION_PROVIDER: 'jev' }), false);
});
