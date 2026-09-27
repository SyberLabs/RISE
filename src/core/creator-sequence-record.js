/** An approved creator sequence is a specific version tied to one source passage and program. */
export const CREATOR_SEQUENCE_SCHEMA = 'rise.creator-sequence.v1';

function reject(path) {
  throw new TypeError(`Invalid creator sequence record at ${path}`);
}

function object(value, keys, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !keys.includes(key))) reject(path);
  return value;
}

function text(value, path) {
  if (typeof value !== 'string' || !value || value !== value.trim() || value.length > 500) {
    reject(path);
  }
  return value;
}

function version(value, path) {
  if (!Number.isSafeInteger(value) || value < 1) reject(path);
  return value;
}

/** Validates a record for storage or inspection, including withdrawn records. */
export function validateCreatorSequenceRecord(value) {
  const record = object(value, [
    'schema', 'id', 'version', 'creator', 'source', 'program', 'allowedVariations', 'approval'
  ], '$');
  if (record.schema !== CREATOR_SEQUENCE_SCHEMA) reject('$.schema');

  const creator = object(record.creator, ['id', 'credit', 'permission'], '$.creator');
  const source = object(record.source, [
    'title', 'author', 'edition', 'passage', 'fingerprint', 'rights'
  ], '$.source');
  const passage = object(source.passage, ['start', 'end'], '$.source.passage');
  const program = object(record.program, ['id', 'version'], '$.program');
  const approval = object(record.approval, ['state'], '$.approval');

  if (!['granted', 'withdrawn'].includes(creator.permission)) reject('$.creator.permission');
  if (!['approved', 'withdrawn'].includes(approval.state)) reject('$.approval.state');
  if (!Array.isArray(record.allowedVariations) || record.allowedVariations.length !== 0) {
    reject('$.allowedVariations');
  }
  if (typeof source.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(source.fingerprint)) {
    reject('$.source.fingerprint');
  }

  return Object.freeze({
    schema: CREATOR_SEQUENCE_SCHEMA,
    id: text(record.id, '$.id'),
    version: version(record.version, '$.version'),
    creator: Object.freeze({
      id: text(creator.id, '$.creator.id'),
      credit: text(creator.credit, '$.creator.credit'),
      permission: creator.permission
    }),
    source: Object.freeze({
      title: text(source.title, '$.source.title'),
      author: text(source.author, '$.source.author'),
      edition: text(source.edition, '$.source.edition'),
      passage: Object.freeze({
        start: text(passage.start, '$.source.passage.start'),
        end: text(passage.end, '$.source.passage.end')
      }),
      fingerprint: source.fingerprint,
      rights: text(source.rights, '$.source.rights')
    }),
    program: Object.freeze({
      id: text(program.id, '$.program.id'),
      version: version(program.version, '$.program.version')
    }),
    allowedVariations: Object.freeze([]),
    approval: Object.freeze({ state: approval.state })
  });
}

/** Gate for admission to playback; withdrawn approval or creator permission refuses. */
export function requireApprovedCreatorSequenceRecord(value) {
  const record = validateCreatorSequenceRecord(value);
  if (record.approval.state !== 'approved' || record.creator.permission !== 'granted') {
    reject('$.approval');
  }
  return record;
}
