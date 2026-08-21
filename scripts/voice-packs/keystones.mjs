import { DEFAULT_VOICE_ID } from '../../src/audio/voice-pack.js';
import { compileSession } from '../../src/core/session-compiler.js';
import { KEYSTONE_MANIFESTS, resolveKeystone } from '../../src/content/keystones.js';

const sessions = [];
const sourceRevisions = [];

for (const manifest of KEYSTONE_MANIFESTS) {
  const resolved = await resolveKeystone(manifest.slug, { allowIncomplete: true });
  if (!resolved.sessionInput) {
    const reasons = resolved.blockers.map(item => item.code).join(', ');
    throw new Error(`Keystone ${manifest.slug} has no runnable exact input: ${reasons}`);
  }
  sessions.push(compileSession(resolved.sessionInput));
  sourceRevisions.push({
    keystone: manifest.slug,
    workId: manifest.source.workId,
    editionId: manifest.source.editionId,
    sourceRevision: manifest.source.sourceRevision,
    entryId: manifest.source.entryId
  });
}

export default Object.freeze({
  label: 'RISE Keystone release voice',
  voiceId: DEFAULT_VOICE_ID,
  // Acoustic corrections are build-time pronunciation directions. The
  // manifest remains keyed by the source atom verbatim, while Kokoro receives
  // punctuation that makes the intended final word audible. Keeping this in
  // the reproducible voice plan prevents a later pack rebuild from restoring
  // a known defective take.
  pronunciations: Object.freeze({
    'Of five long winters! and again I hear':
      'Of five long winters! And again, I hear.'
  }),
  sourceRevisions: Object.freeze(sourceRevisions),
  sessions: Object.freeze(sessions)
});
