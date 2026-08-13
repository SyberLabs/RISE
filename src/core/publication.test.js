import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  PUBLICATION_RECEIPT_SCHEMA,
  PUBLICATION_REVIEW_SCHEMA,
  PublicationError,
  approvePublication,
  deliverApproved,
  enqueuePublicationReview,
  schedulePublication,
  validatePublicationApproval,
  validatePublicationReceipt,
  withdrawPublication
} from './publication.js';
import { RENDER_MANIFEST_SCHEMA } from './render/environment.js';
import { contentHashOf } from './render/hash.js';

const NOW = '2026-08-13T21:00:00.000Z';
const LATER = '2026-08-14T00:00:00.000Z';
const TOO_SOON = '2026-08-13T20:00:00.000Z';
const ROOT = dirname(fileURLToPath(import.meta.url));

async function makePack({ rights = {}, files = {}, profile = 'social-portrait-1080' } = {}) {
  const jobHash = await contentHashOf({ job: 'publication-fixture' });
  const planHash = await contentHashOf({ plan: 'publication-fixture' });
  const outputHashes = {
    frames: await contentHashOf({ frames: 1 }),
    audio: await contentHashOf({ audio: 1 }),
    captionsVtt: await contentHashOf('WEBVTT'),
    credits: await contentHashOf('Credits — RISE render package')
  };
  return {
    'render-manifest.json': {
      schema: RENDER_MANIFEST_SCHEMA,
      jobId: 'job-publication',
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
    'thumbnail.bmp': new Uint8Array([0x42, 0x4d, 9]),
    ...files
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

async function queuedItem(overrides = {}) {
  const pack = overrides.pack || await makePack(overrides.packOptions || {});
  return enqueuePublicationReview({
    id: overrides.id || 'review-1',
    projectId: 'project-memory',
    destinationKind: overrides.destinationKind || 'social-short',
    pack,
    metadata: metadata(overrides.metadata),
    now: NOW
  });
}

function approvalFor(item, overrides = {}) {
  return {
    schema: PUBLICATION_APPROVAL_SCHEMA,
    reviewItemId: item.id,
    artifactHash: item.artifact.packageHash,
    decision: 'approve',
    actor: 'human',
    authority: 'user',
    watchedArtifact: true,
    decidedAt: NOW,
    ...overrides
  };
}

function expectCode(error, code) {
  expect(error).toBeInstanceOf(PublicationError);
  expect(error.code).toBe(code);
}

describe('publication pipeline', () => {
  it('enqueues a destination-neutral review item from a hashed package', async () => {
    const item = await queuedItem();
    expect(item.schema).toBe(PUBLICATION_REVIEW_SCHEMA);
    expect(item.status).toBe('queued');
    expect(item.destinationKind).toBe('social-short');
    expect(item.artifact.packageHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(item.metadata.thumbnail).toBe('poster');
    expect(item.rights.publicationBlocked).toBe(false);
  });

  it('does not enqueue from render completion, and the agent has no publish op', () => {
    for (const file of ['render/package.js', 'render/driver.js', 'render/distribution.js']) {
      const src = readFileSync(join(ROOT, file), 'utf8');
      expect(src).not.toMatch('enqueuePublicationReview');
      expect(src).not.toMatch('publication.js');
    }
    expect(AGENT_OPERATION_OPS).not.toContain('publish');
    expect(AGENT_OPERATION_OPS).not.toContain('approve-publication');
    expect(AGENT_OPERATION_OPS).not.toContain('deliver-publication');
    expect(() => validateAgentOperationSet({
      schema: AGENT_OPERATION_SET_SCHEMA,
      id: 'ops-publish',
      projectId: 'project-memory',
      baseRevision: 0,
      generationId: 'run-1',
      operations: [{ op: 'publish', id: 'op-pub' }]
    })).toThrow(AgentOperationError);
  });

  it('refuses agent or proposed actors, and requires the watched artifact hash', async () => {
    const item = await queuedItem();
    for (const actor of ['agent', 'proposed']) {
      try {
        validatePublicationApproval(approvalFor(item, { actor }));
        throw new Error('expected refusal');
      } catch (error) {
        expectCode(error, 'PUBLICATION_HUMAN_REQUIRED');
      }
    }
    try {
      validatePublicationApproval(approvalFor(item, { watchedArtifact: false }));
      throw new Error('expected refusal');
    } catch (error) {
      expectCode(error, 'PUBLICATION_WATCH_REQUIRED');
    }
    try {
      approvePublication({
        item,
        approval: approvalFor(item, {
          artifactHash: await contentHashOf({ other: true })
        })
      });
      throw new Error('expected refusal');
    } catch (error) {
      expectCode(error, 'PUBLICATION_ARTIFACT');
    }
  });

  it('blocks public approval when rights are unknown or user-asserted', async () => {
    const item = await queuedItem({
      packOptions: {
        rights: {
          distributionClass: 'public',
          publicationBlocked: true,
          unresolved: [{ assetId: 'asset-unknown' }]
        }
      }
    });
    expect(item.rights.publicationBlocked).toBe(true);
    try {
      approvePublication({ item, approval: approvalFor(item) });
      throw new Error('expected refusal');
    } catch (error) {
      expectCode(error, 'PUBLICATION_RIGHTS_UNRESOLVED');
      expect(describeImportFailure(error)).toContain('cannot approve a public destination');
    }
  });

  it('delivers an approved artifact through the mock adapter without credentials', async () => {
    const queued = await queuedItem();
    const approved = approvePublication({ item: queued, approval: approvalFor(queued) });
    const adapter = createMockSocialAdapter();
    const { item, receipt, replayed } = await deliverApproved({
      item: approved,
      adapter,
      idempotencyKey: 'deliver-1',
      now: NOW
    });
    expect(replayed).toBe(false);
    expect(item.status).toBe('delivered');
    expect(receipt.schema).toBe(PUBLICATION_RECEIPT_SCHEMA);
    expect(receipt.state).toBe('published');
    expect(receipt.artifactHash).toBe(queued.artifact.packageHash);
    expect(receipt.platformPostId).toBe('post-deliver-1');
    expect(receipt.platformUrl).toBe('https://social.example/posts/deliver-1');
    expect(receipt.accountIdentity).toBe('mock:@rise-demo');
    expect(receipt).not.toHaveProperty('token');
    expect(receipt).not.toHaveProperty('authorization');
    expect(JSON.stringify(receipt)).not.toMatch(/token|authorization|password|cookie|secret/i);
    expect(adapter.deliveryCount).toBe(1);
  });

  it('replays the same receipt for the same idempotency key without calling the adapter again', async () => {
    const queued = await queuedItem();
    const approved = approvePublication({ item: queued, approval: approvalFor(queued) });
    const adapter = createMockSocialAdapter();
    const first = await deliverApproved({
      item: approved,
      adapter,
      idempotencyKey: 'deliver-1',
      now: NOW
    });
    const second = await deliverApproved({
      item: approved,
      adapter,
      idempotencyKey: 'deliver-1',
      receipts: [first.receipt],
      now: NOW
    });
    expect(second.replayed).toBe(true);
    expect(second.receipt).toEqual(first.receipt);
    expect(adapter.deliveryCount).toBe(1);
  });

  it('treats a metadata or thumbnail change as a new review identity', async () => {
    const pack = await makePack();
    const original = await queuedItem({ pack });
    const retitled = await queuedItem({
      id: 'review-2',
      pack,
      metadata: { title: 'A different title' }
    });
    const thumbnail = await queuedItem({
      id: 'review-3',
      pack,
      metadata: { thumbnail: 'thumbnail' }
    });
    expect(retitled.artifact.packageHash).not.toBe(original.artifact.packageHash);
    expect(thumbnail.artifact.packageHash).not.toBe(original.artifact.packageHash);
    try {
      approvePublication({
        item: retitled,
        approval: approvalFor(original, { reviewItemId: retitled.id })
      });
      throw new Error('expected refusal');
    } catch (error) {
      expectCode(error, 'PUBLICATION_ARTIFACT');
    }
  });

  it('withdraws a published receipt through the adapter', async () => {
    const queued = await queuedItem();
    const approved = approvePublication({ item: queued, approval: approvalFor(queued) });
    const adapter = createMockSocialAdapter();
    const delivered = await deliverApproved({
      item: approved,
      adapter,
      idempotencyKey: 'deliver-1',
      now: NOW
    });
    const withdrawn = await withdrawPublication({
      item: delivered.item,
      receipt: delivered.receipt,
      adapter,
      now: LATER
    });
    expect(withdrawn.item.status).toBe('withdrawn');
    expect(withdrawn.receipt.state).toBe('withdrawn');
    expect(withdrawn.receipt.withdrawnAt).toBe(LATER);
    expect(withdrawn.receipt.platformPostId).toBe(delivered.receipt.platformPostId);
    expect(adapter.withdrawCount).toBe(1);
  });

  it('refuses scheduling before approval and delivery before the scheduled time', async () => {
    const queued = await queuedItem();
    try {
      schedulePublication({ item: queued, notBefore: LATER, now: NOW });
      throw new Error('expected refusal');
    } catch (error) {
      expectCode(error, 'PUBLICATION_NOT_APPROVED');
    }
    const approved = approvePublication({ item: queued, approval: approvalFor(queued) });
    try {
      schedulePublication({ item: approved, notBefore: TOO_SOON, now: NOW });
      throw new Error('expected refusal');
    } catch (error) {
      expectCode(error, 'PUBLICATION_SCHEDULE');
    }
    const scheduled = schedulePublication({ item: approved, notBefore: LATER, now: NOW });
    expect(scheduled.status).toBe('scheduled');
    expect(scheduled.scheduledFor).toBe(LATER);
    const adapter = createMockSocialAdapter();
    try {
      await deliverApproved({
        item: scheduled,
        adapter,
        idempotencyKey: 'deliver-1',
        now: NOW
      });
      throw new Error('expected refusal');
    } catch (error) {
      expectCode(error, 'PUBLICATION_SCHEDULED');
    }
    const delivered = await deliverApproved({
      item: scheduled,
      adapter,
      idempotencyKey: 'deliver-1',
      now: LATER
    });
    expect(delivered.receipt.state).toBe('published');
  });

  it('refuses credentials on a review item or receipt', async () => {
    const queued = await queuedItem();
    try {
      validatePublicationApproval(approvalFor(queued, { token: 'secret-token' }));
      throw new Error('expected refusal');
    } catch (error) {
      expectCode(error, 'PUBLICATION_CREDENTIALS');
    }
    const approved = approvePublication({ item: queued, approval: approvalFor(queued) });
    const adapter = createMockSocialAdapter({
      onDeliver: () => ({
        accountIdentity: 'mock:@rise-demo',
        platformPostId: 'post-1',
        platformUrl: 'https://social.example/posts/1',
        state: 'published',
        authorization: 'Bearer leaked'
      })
    });
    try {
      await deliverApproved({
        item: approved,
        adapter,
        idempotencyKey: 'deliver-1',
        now: NOW
      });
      throw new Error('expected refusal');
    } catch (error) {
      expectCode(error, 'PUBLICATION_CREDENTIALS');
    }
    try {
      validatePublicationReceipt({
        schema: PUBLICATION_RECEIPT_SCHEMA,
        id: 'receipt-leaked',
        reviewItemId: queued.id,
        destinationId: 'mock-social',
        accountIdentity: 'mock:@rise-demo',
        artifactHash: queued.artifact.packageHash,
        idempotencyKey: 'deliver-1',
        state: 'published',
        deliveredAt: NOW,
        platformPostId: 'post-1',
        platformUrl: 'https://social.example/posts/1',
        token: 'nope'
      });
      throw new Error('expected refusal');
    } catch (error) {
      expectCode(error, 'PUBLICATION_CREDENTIALS');
    }
  });
});
