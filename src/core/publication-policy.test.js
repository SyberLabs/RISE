import { describe, expect, it } from 'vitest';
import {
  AGENT_OPERATION_OPS,
  AGENT_OPERATION_SET_SCHEMA,
  AgentOperationError,
  validateAgentOperationSet
} from './agent-operations.js';
import { describeImportFailure } from './experience-program-io.js';
import { createMockSocialAdapter } from './publication-adapters.js';
import {
  PUBLICATION_APPROVAL_SCHEMA,
  PublicationError,
  approvePublication,
  enqueuePublicationReview
} from './publication.js';
import {
  CHANNEL_POLICY_SCHEMA,
  CREDENTIAL_CUSTODY_SCHEMA,
  adoptChannelPolicy,
  assertAutomationAllowed,
  clearEmergencyStop,
  createPublicationLedger,
  deliverUnderPolicy,
  engageEmergencyStop,
  recordRightsWithdrawal,
  validateCredentialCustody
} from './publication-policy.js';
import { RENDER_MANIFEST_SCHEMA } from './render/environment.js';
import { contentHashOf } from './render/hash.js';

const NOW = '2026-08-13T21:00:00.000Z';
const LATER = '2026-08-14T00:00:00.000Z';
const SOON = '2026-08-13T21:00:30.000Z';
const HUMAN = { actor: 'human', authority: 'user' };

async function makePack({ rights = {}, profile = 'social-portrait-1080' } = {}) {
  const jobHash = await contentHashOf({ job: 'policy-fixture' });
  const planHash = await contentHashOf({ plan: 'policy-fixture' });
  const outputHashes = {
    frames: await contentHashOf({ frames: 1 }),
    audio: await contentHashOf({ audio: 1 }),
    captionsVtt: await contentHashOf('WEBVTT'),
    credits: await contentHashOf('Credits — RISE render package')
  };
  return {
    'render-manifest.json': {
      schema: RENDER_MANIFEST_SCHEMA,
      jobId: 'job-policy',
      jobHash,
      planHash,
      projectId: 'project-memory',
      profile,
      outputHashes
    },
    'rights-report.json': {
      distributionClass: 'public',
      publicationBlocked: false,
      unresolved: [],
      ...rights
    },
    'credits.txt': 'Credits — RISE render package',
    'poster.bmp': new Uint8Array([0x42, 0x4d, 1, 2, 3]),
    'thumbnail.bmp': new Uint8Array([0x42, 0x4d, 9])
  };
}

function metadata(overrides = {}) {
  return {
    title: 'A quiet reading',
    description: 'Portrait excerpt for review.',
    thumbnail: 'poster',
    captionsMode: 'sidecar-and-burn-in',
    ...overrides
  };
}

async function approvedItem(overrides = {}) {
  const pack = overrides.pack || await makePack(overrides.packOptions || {});
  const queued = await enqueuePublicationReview({
    id: overrides.id || 'review-1',
    projectId: 'project-memory',
    destinationKind: overrides.destinationKind || 'social-short',
    pack,
    metadata: metadata(overrides.metadata),
    now: NOW
  });
  return approvePublication({
    item: queued,
    approval: {
      schema: PUBLICATION_APPROVAL_SCHEMA,
      reviewItemId: queued.id,
      artifactHash: queued.artifact.packageHash,
      decision: 'approve',
      actor: 'human',
      authority: 'user',
      watchedArtifact: true,
      decidedAt: NOW
    }
  });
}

function policyDraft(overrides = {}) {
  return {
    schema: CHANNEL_POLICY_SCHEMA,
    id: 'policy-social',
    destinationKind: 'social-short',
    accountIdentity: 'mock:@rise-demo',
    profiles: ['social-portrait-1080'],
    editorial: { requireCaptions: true, requireCredits: true },
    frequency: { maxDeliveriesPerDay: 3, minIntervalMs: 0 },
    cost: { maxCentsPerDay: 100 },
    moderation: { escalateOn: ['unresolved-rights', 'private-review'] },
    rights: { requireResolved: true, renewOnWithdrawal: true },
    accountable: { actor: 'human', authority: 'user', name: 'Mateo' },
    emergencyStop: false,
    ...overrides
  };
}

function custodyDraft(overrides = {}) {
  return {
    schema: CREDENTIAL_CUSTODY_SCHEMA,
    id: 'custody-social',
    destinationId: 'mock-social',
    accountIdentity: 'mock:@rise-demo',
    secretRef: 'vault:mock-social',
    ...overrides
  };
}

function expectCode(error, code) {
  expect(error).toBeInstanceOf(PublicationError);
  expect(error.code).toBe(code);
}

describe('policy-bounded publication automation', () => {
  it('lets a person adopt a channel policy that names who is accountable', () => {
    const policy = adoptChannelPolicy({
      policy: policyDraft(),
      actor: HUMAN,
      now: NOW
    });
    expect(policy.schema).toBe(CHANNEL_POLICY_SCHEMA);
    expect(policy.accountable).toEqual({ actor: 'human', authority: 'user', name: 'Mateo' });
    expect(policy.adoptedBy).toEqual(HUMAN);
    expect(policy.emergencyStop).toBe(false);
  });

  it('refuses agent adoption, publish ops, and raw credentials in custody', () => {
    try {
      adoptChannelPolicy({
        policy: policyDraft(),
        actor: { actor: 'agent', authority: 'proposed' },
        now: NOW
      });
      throw new Error('expected refusal');
    } catch (error) {
      expectCode(error, 'PUBLICATION_POLICY_HUMAN_REQUIRED');
    }
    expect(AGENT_OPERATION_OPS).not.toContain('adopt-policy');
    expect(AGENT_OPERATION_OPS).not.toContain('emergency-stop');
    expect(() => validateAgentOperationSet({
      schema: AGENT_OPERATION_SET_SCHEMA,
      id: 'ops-policy',
      projectId: 'project-memory',
      baseRevision: 0,
      generationId: 'run-1',
      operations: [{ op: 'adopt-policy', id: 'op-policy' }]
    })).toThrow(AgentOperationError);
    try {
      validateCredentialCustody(custodyDraft({ token: 'leaked' }));
      throw new Error('expected refusal');
    } catch (error) {
      expectCode(error, 'PUBLICATION_CREDENTIALS');
    }
    try {
      validateCredentialCustody(custodyDraft({ secretRef: 'https://example/secret' }));
      throw new Error('expected refusal');
    } catch (error) {
      expectCode(error, 'PUBLICATION_URI');
    }
  });

  it('delivers an already-approved artifact under policy without putting the vault handle on the receipt', async () => {
    const item = await approvedItem();
    const policy = adoptChannelPolicy({ policy: policyDraft(), actor: HUMAN, now: NOW });
    const adapter = createMockSocialAdapter();
    const { receipt, ledger, replayed } = await deliverUnderPolicy({
      item,
      adapter,
      policy,
      custody: custodyDraft(),
      idempotencyKey: 'auto-1',
      now: NOW
    });
    expect(replayed).toBe(false);
    expect(receipt.state).toBe('published');
    expect(receipt.artifactHash).toBe(item.artifact.packageHash);
    expect(JSON.stringify(receipt)).not.toContain('vault:mock-social');
    expect(JSON.stringify(receipt)).not.toMatch(/token|authorization|password|cookie/i);
    expect(ledger.events).toHaveLength(1);
    expect(ledger.events[0].action).toBe('deliver');
    expect(ledger.events[0].reason).toContain('Mateo');
    expect(adapter.deliveryCount).toBe(1);
  });

  it('replays an idempotent delivery without counting it against frequency', async () => {
    const item = await approvedItem();
    const policy = adoptChannelPolicy({
      policy: policyDraft({ frequency: { maxDeliveriesPerDay: 1, minIntervalMs: 0 } }),
      actor: HUMAN,
      now: NOW
    });
    const adapter = createMockSocialAdapter();
    const first = await deliverUnderPolicy({
      item,
      adapter,
      policy,
      custody: custodyDraft(),
      idempotencyKey: 'auto-1',
      now: NOW
    });
    const second = await deliverUnderPolicy({
      item,
      adapter,
      policy,
      custody: custodyDraft(),
      ledger: first.ledger,
      receipts: [first.receipt],
      idempotencyKey: 'auto-1',
      now: SOON
    });
    expect(second.replayed).toBe(true);
    expect(second.receipt).toEqual(first.receipt);
    expect(adapter.deliveryCount).toBe(1);
    expect(second.ledger.events).toHaveLength(1);
  });

  it('enforces frequency and cost ceilings on new deliveries', async () => {
    const firstItem = await approvedItem({ id: 'review-1' });
    const secondItem = await approvedItem({ id: 'review-2', metadata: { title: 'Another reading' } });
    const policy = adoptChannelPolicy({
      policy: policyDraft({
        frequency: { maxDeliveriesPerDay: 1, minIntervalMs: 3_600_000 },
        cost: { maxCentsPerDay: 0 }
      }),
      actor: HUMAN,
      now: NOW
    });
    const adapter = createMockSocialAdapter();
    const first = await deliverUnderPolicy({
      item: firstItem,
      adapter,
      policy,
      custody: custodyDraft(),
      idempotencyKey: 'auto-1',
      costCents: 0,
      now: NOW
    });
    try {
      await deliverUnderPolicy({
        item: secondItem,
        adapter,
        policy,
        custody: custodyDraft(),
        ledger: first.ledger,
        receipts: [first.receipt],
        idempotencyKey: 'auto-2',
        now: SOON
      });
      throw new Error('expected refusal');
    } catch (error) {
      expectCode(error, 'PUBLICATION_FREQUENCY');
    }
    const cheapPolicy = adoptChannelPolicy({
      policy: policyDraft({
        id: 'policy-cost',
        frequency: { maxDeliveriesPerDay: 3, minIntervalMs: 0 },
        cost: { maxCentsPerDay: 0 }
      }),
      actor: HUMAN,
      now: NOW
    });
    try {
      await deliverUnderPolicy({
        item: firstItem,
        adapter: createMockSocialAdapter(),
        policy: cheapPolicy,
        custody: custodyDraft(),
        idempotencyKey: 'auto-cost',
        costCents: 1,
        now: NOW
      });
      throw new Error('expected refusal');
    } catch (error) {
      expectCode(error, 'PUBLICATION_COST');
      expect(describeImportFailure(error)).toContain('daily cost ceiling');
    }
  });

  it('stops the channel immediately and requires a person to clear it', async () => {
    const item = await approvedItem();
    const adopted = adoptChannelPolicy({ policy: policyDraft(), actor: HUMAN, now: NOW });
    const stopped = engageEmergencyStop({
      policy: adopted,
      actor: { actor: 'host', authority: 'host' },
      reason: 'Platform incident',
      now: SOON
    });
    expect(stopped.policy.emergencyStop).toBe(true);
    try {
      assertAutomationAllowed({
        policy: stopped.policy,
        item,
        custody: custodyDraft(),
        ledger: stopped.ledger,
        now: SOON
      });
      throw new Error('expected refusal');
    } catch (error) {
      expectCode(error, 'PUBLICATION_EMERGENCY_STOP');
      expect(describeImportFailure(error)).toContain('emergency stop');
    }
    try {
      clearEmergencyStop({
        policy: stopped.policy,
        actor: { actor: 'host', authority: 'host' },
        now: LATER,
        ledger: stopped.ledger
      });
      throw new Error('expected refusal');
    } catch (error) {
      expectCode(error, 'PUBLICATION_POLICY_HUMAN_REQUIRED');
    }
    const cleared = clearEmergencyStop({
      policy: stopped.policy,
      actor: HUMAN,
      now: LATER,
      ledger: stopped.ledger
    });
    expect(cleared.policy.emergencyStop).toBe(false);
    assertAutomationAllowed({
      policy: cleared.policy,
      item,
      custody: custodyDraft(),
      ledger: cleared.ledger,
      now: LATER
    });
  });

  it('requires a new human review after rights are withdrawn', async () => {
    const item = await approvedItem();
    const policy = adoptChannelPolicy({ policy: policyDraft(), actor: HUMAN, now: NOW });
    const ledger = recordRightsWithdrawal({
      projectId: 'project-memory',
      assetId: 'asset-unknown',
      policyId: policy.id,
      now: LATER
    });
    try {
      assertAutomationAllowed({
        policy,
        item,
        custody: custodyDraft(),
        ledger,
        now: LATER
      });
      throw new Error('expected refusal');
    } catch (error) {
      expectCode(error, 'PUBLICATION_RIGHTS_WITHDRAWN');
      expect(describeImportFailure(error)).toContain('review the artifact again');
    }
  });

  it('escalates missing captions instead of posting them', async () => {
    const item = await approvedItem({
      metadata: { captionsMode: undefined }
    });
    expect(item.metadata.captionsMode).toBeUndefined();
    const policy = adoptChannelPolicy({ policy: policyDraft(), actor: HUMAN, now: NOW });
    try {
      assertAutomationAllowed({
        policy,
        item,
        custody: custodyDraft(),
        now: NOW
      });
      throw new Error('expected refusal');
    } catch (error) {
      expectCode(error, 'PUBLICATION_ESCALATE');
    }
  });

  it('cannot use a channel policy to approve a queued artifact', async () => {
    const pack = await makePack();
    const queued = await enqueuePublicationReview({
      id: 'review-queued',
      projectId: 'project-memory',
      destinationKind: 'social-short',
      pack,
      metadata: metadata(),
      now: NOW
    });
    const policy = adoptChannelPolicy({ policy: policyDraft(), actor: HUMAN, now: NOW });
    try {
      assertAutomationAllowed({
        policy,
        item: queued,
        custody: custodyDraft(),
        now: NOW
      });
      throw new Error('expected refusal');
    } catch (error) {
      expectCode(error, 'PUBLICATION_NOT_APPROVED');
    }
  });
});
