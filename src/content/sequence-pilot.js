import { KEYSTONE_MANIFESTS, keystonePath } from './keystones.js';

export const SEQUENCE_PILOT_SCHEMA = 'rise.sequence-pilot.v1';

const READER_PROMISES = Object.freeze({
  meditations: 'Read Marcus Aurelius one thought at a time, with each word filling the frame.',
  metamorphoses: 'Watch the world take shape as Ovid’s creation story unfolds through luminous forms.',
  tintern: 'Return to a remembered landscape with Wordsworth as the poem and painting share the frame.'
});

// Frozen composition identities for this pilot. A changed manifest must get a
// reviewed fingerprint and version before its feedback can be compared.
const PILOT_RELEASES = Object.freeze({
  meditations: { version: 1, fingerprint: '0ea6e2837797ade9d1a348155784015ddaa661236537bdb11696adc388ed0add' },
  metamorphoses: { version: 1, fingerprint: '0b262052a17eb2f0d96b63d32e98640887c7a620a7abd0671e7d38f10ab3cf69' },
  tintern: { version: 1, fingerprint: '8a059dbcafb952ecef9d2d4213570d116ba1ec78adaa86ca9ad68c19265347e2' }
});

export const SEQUENCE_PILOT = Object.freeze(KEYSTONE_MANIFESTS
  .filter(manifest => manifest.admitted === true)
  .map(manifest => {
    const release = PILOT_RELEASES[manifest.slug];
    if (!release) throw new Error(`Unreviewed Keystone pilot release: ${manifest.slug}`);
    return Object.freeze({
      schema: SEQUENCE_PILOT_SCHEMA,
      version: release.version,
      id: `keystone:${manifest.slug}:v${release.version}:${release.fingerprint.slice(0, 24)}`,
      manifestFingerprint: release.fingerprint,
      slug: manifest.slug,
      title: manifest.title,
      author: manifest.author,
      attribution: Object.freeze({ title: manifest.title, author: manifest.author }),
      editionId: manifest.source.editionId,
      sourceRevision: manifest.source.sourceRevision,
      promise: READER_PROMISES[manifest.slug],
      path: keystonePath(manifest.slug),
      manifest
    });
  }));

export function nextSequencePilot(currentSlug) {
  if (SEQUENCE_PILOT.length < 2 && SEQUENCE_PILOT[0]?.slug === currentSlug) return null;
  const index = SEQUENCE_PILOT.findIndex(item => item.slug === currentSlug);
  return SEQUENCE_PILOT[(index + 1) % SEQUENCE_PILOT.length] || null;
}
