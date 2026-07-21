import { describe, expect, it } from 'vitest';
import {
  AtriumHandoffError,
  calculateAtriumPayloadChecksum,
  createAtriumJourneyHandoff
} from './handoff.js';
import { compileSession } from '../../core/session-compiler.js';

async function readyFixture(text = 'Know thyself and examine the life before you.') {
  const checksum = await calculateAtriumPayloadChecksum(text);
  const source = {
    id: 'src-fixture',
    domain: 'philosophy',
    workTitle: 'Test Edition',
    author: 'Test Author',
    provider: 'institutional-test',
    canonicalUrl: 'https://example.org/edition',
    canonicalId: 'edition:1',
    editor: 'Test Editor',
    translator: null,
    editionDate: '1901',
    language: 'en',
    originalLanguage: 'en',
    checksum: `sha256:${'1'.repeat(64)}`,
    retrievedAt: '2026-07-17',
    rights: {
      status: 'public-domain-confirmed',
      jurisdictions: ['US'],
      reviewedAt: '2026-07-17',
      attribution: 'Test Author, Test Edition'
    },
    status: 'publishable'
  };
  const passage = {
    id: 'pass-fixture',
    domain: 'philosophy',
    sourceId: source.id,
    label: 'Test passage',
    canonicalLocator: 'section 1',
    payloadPath: './passages/test.txt',
    payloadChecksum: checksum,
    estimatedWords: text.trim().split(/\s+/u).length,
    textVerified: true,
    rightsStatus: 'public-domain-confirmed',
    status: 'publishable'
  };
  const journey = {
    id: 'seq-fixture',
    domain: 'philosophy',
    title: 'The Tested Life',
    anchorIds: ['ph-fixture'],
    segments: [{ passageId: passage.id, role: 'proposition' }],
    openRequirements: [],
    status: 'publishable'
  };
  return { text, source, passage, journey };
}

describe('Atrium Chamber handoff', () => {
  it('rejects an unaudited journey before consulting payload content', async () => {
    const fixture = await readyFixture();
    const blockedJourney = {
      ...fixture.journey,
      status: 'blocked',
      openRequirements: ['External editorial review required.']
    };
    await expect(createAtriumJourneyHandoff(blockedJourney, {
      passages: [fixture.passage],
      sources: [fixture.source],
      payloads: {}
    })).rejects.toMatchObject({
      name: 'AtriumHandoffError',
      code: 'ATRIUM_JOURNEY_NOT_READY'
    });
  });

  it('verifies payload bytes and emits edition-level provenance', async () => {
    const fixture = await readyFixture();
    const handoff = await createAtriumJourneyHandoff(fixture.journey, {
      passages: [fixture.passage],
      sources: [fixture.source],
      payloads: { [fixture.passage.id]: fixture.text }
    });

    expect(handoff.source).toBe('Atrium · The Tested Life');
    expect(handoff.config.origin).toMatchObject({ view: 'atrium', data: { selectedId: 'ph-fixture' } });
    expect(handoff.config.sources[0]).toMatchObject({
      id: 'pass-fixture',
      providerId: 'institutional-test',
      provenance: {
        sourceId: 'src-fixture',
        passageId: 'pass-fixture',
        canonicalLocator: 'section 1'
      }
    });
  });

  it('fails closed when packaged bytes or word counts drift from the manifest', async () => {
    const fixture = await readyFixture();
    await expect(createAtriumJourneyHandoff(fixture.journey, {
      passages: [fixture.passage],
      sources: [fixture.source],
      payloads: { [fixture.passage.id]: `${fixture.text} altered` }
    })).rejects.toBeInstanceOf(AtriumHandoffError);

    const wrongCount = { ...fixture.passage, estimatedWords: fixture.passage.estimatedWords + 1 };
    await expect(createAtriumJourneyHandoff(fixture.journey, {
      passages: [wrongCount],
      sources: [fixture.source],
      payloads: { [fixture.passage.id]: fixture.text }
    })).rejects.toMatchObject({ code: 'ATRIUM_PAYLOAD_WORD_COUNT' });
  });

  it('survives the canonical compiler with atom-to-passage linkage intact', async () => {
    const fixture = await readyFixture();
    const handoff = await createAtriumJourneyHandoff(fixture.journey, {
      passages: [fixture.passage],
      sources: [fixture.source],
      payloads: { [fixture.passage.id]: fixture.text }
    });
    const session = compileSession({
      ...handoff.config,
      title: handoff.source,
      text: handoff.text
    });

    expect(session.provenance).toMatchObject({ journeyId: 'seq-fixture', passageIds: ['pass-fixture'] });
    expect(session.sources[0].provenance).toMatchObject({
      sourceId: 'src-fixture',
      editionChecksum: fixture.source.checksum,
      canonicalLocator: 'section 1'
    });
    expect(session.atoms.filter(atom => atom.content)
      .every(atom => atom.sourceId === 'pass-fixture')).toBe(true);
  });
});
