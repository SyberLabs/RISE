/**
 * Deploy the matching Worker and client, then run against Neon with NEON_DATABASE_URL set.
 * Release manifests pin the exact editions or original readings and bytes;
 * this editorial list supplies short, public recommendation metadata.
 */
import { neon } from '@neondatabase/serverless';
import releaseInventory from '../src/content/archive/release-inventory.json' with { type: 'json' };
import modernManifest from '../src/content/modern-readings-manifest.json' with { type: 'json' };

const EDITORIAL = {
  middlemarch: ['Middlemarch', 'George Eliot', 'A rich novel of relationships, ambition, and life in a provincial town.', 'Choose for a reader seeking a long, psychologically detailed social novel about relationships, choices, and community.'],
  'the-brothers-karamazov': ['The Brothers Karamazov', 'Fyodor Dostoevsky', 'A searching family novel about faith, conflict, and moral responsibility.', 'Choose for a reader seeking an intense, philosophical family drama about faith, guilt, and moral responsibility.'],
  'literary-meditations': ['Meditations', 'Marcus Aurelius', 'Brief Stoic reflections on attention, conduct, and inner steadiness.', 'Choose for a reader seeking short, reflective philosophy about discipline, conduct, or calm.'],
  'sacred-tao-te-ching': ['Tao Te Ching', 'Laozi', 'Compact poetic sayings about balance, humility, and the way.', 'Choose for a reader seeking concise philosophical or spiritual sayings about balance and simplicity.'],
  'the-iliad': ['The Iliad', 'Homer', 'A war epic about honor, anger, loss, and human limits.', 'Choose for a reader seeking an ancient heroic epic about war, anger, honor, and grief.'],
  'the-divine-comedy': ['The Divine Comedy', 'Dante Alighieri', 'An imaginative verse journey through the afterlife and moral consequence.', 'Choose for a reader seeking allegorical epic poetry, spiritual journey, or medieval imagination.'],
  metamorphoses: ['Metamorphoses', 'Ovid', 'Mythic stories of creation, desire, and transformation.', 'Choose for a reader seeking classical mythology, vivid narrative poetry, or stories about transformation.'],
  'spoon-river-anthology': ['Spoon River Anthology', 'Edgar Lee Masters', 'Short first-person poems revealing the lives of an American town.', 'Choose for a reader seeking short poems, distinct voices, or intimate stories of ordinary lives.'],
  'oedipus-rex': ['Oedipus Rex', 'Sophocles', 'A compact Greek tragedy about truth, fate, and self-knowledge.', 'Choose for a reader seeking a short dramatic tragedy about fate, truth, and self-discovery.'],
  'literary-walden': ['Walden', 'Henry David Thoreau', 'Observations on nature, solitude, and deliberate living.', 'Choose for a reader seeking nature writing, solitude, self-reliance, or reflective nonfiction.'],
  ulysses: ['Ulysses', 'James Joyce', 'An experimental day-long journey through Dublin and consciousness.', 'Choose for a reader seeking challenging modernist fiction, language experiments, or urban interior life.'],
  'paradise-lost': ['Paradise Lost', 'John Milton', 'A blank-verse epic about rebellion, temptation, and the Fall.', 'Choose for a reader seeking English epic poetry about myth, theology, rebellion, and temptation.'],
  'literary-essays-emerson': ['Essays', 'Ralph Waldo Emerson', 'Arguments for self-reliance, nature, and intellectual independence.', 'Choose for a reader seeking philosophical essays about self-reliance, individuality, or nature.'],
  'confucius-analects': ['The Analects', 'Confucius', 'Short teachings on learning, character, and social responsibility.', 'Choose for a reader seeking brief ethical teachings about learning, conduct, and community.'],
  'lyrical-ballads': ['Lyrical Ballads', 'William Wordsworth and Samuel Taylor Coleridge', 'Romantic poems of landscape, memory, and everyday life.', 'Choose for a reader seeking Romantic lyric poetry, landscape, memory, or emotional reflection.']
};

const released = Object.values(releaseInventory)
  .filter(item => item.editionId?.startsWith('standard-ebooks:'));
if (released.length !== Object.keys(EDITORIAL).length
  || released.some(item => !Object.hasOwn(EDITORIAL, item.workId)
    || !item.source?.url?.startsWith('https://standardebooks.org/ebooks/'))) {
  throw new Error('Editorial seed must match every served Standard Ebooks edition.');
}

const CATALOG = [
  ...Object.entries(EDITORIAL).map(([workId, [title, author, fit, criterion]]) => ({
    workId, title, author, fit, criterion, edition: releaseInventory[workId]
  })),
  ...Object.values(modernManifest).map(edition => ({
    workId: edition.workId, title: edition.title, author: edition.author,
    fit: edition.fitDescription, criterion: edition.decisionCriterion, edition
  }))
];
if (new Set(CATALOG.map(item => item.workId)).size !== CATALOG.length) {
  throw new Error('The reading seed contains duplicate work IDs.');
}

const createTable = `CREATE TABLE IF NOT EXISTS rise_books (
  work_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  edition_id TEXT NOT NULL CHECK (edition_id LIKE 'standard-ebooks:%' OR edition_id LIKE 'rise-original:%'),
  source_revision TEXT NOT NULL CHECK (source_revision ~ '^sha256:[0-9a-f]{64}$'),
  fit_description TEXT NOT NULL,
  decision_criterion TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);`;
const widenEditionConstraint = `ALTER TABLE rise_books DROP CONSTRAINT IF EXISTS rise_books_edition_id_check;
ALTER TABLE rise_books ADD CONSTRAINT rise_books_edition_id_check
  CHECK (edition_id LIKE 'standard-ebooks:%' OR edition_id LIKE 'rise-original:%');`;

if (process.argv.includes('--print-sql')) {
  const quote = value => `'${String(value).replaceAll("'", "''")}'`;
  const values = CATALOG.map(({ workId, title, author, fit, criterion, edition }) => {
    return `  (${[workId, title, author, edition.editionId, edition.sourceRevision, fit, criterion]
      .map(quote).join(', ')}, TRUE)`;
  }).join(',\n');
  process.stdout.write(`-- Deploy the matching Worker and client before applying this seed.\n${createTable}\n\n${widenEditionConstraint}\n\nINSERT INTO rise_books
  (work_id, title, author, edition_id, source_revision, fit_description, decision_criterion, active)
VALUES\n${values}
ON CONFLICT (work_id) DO UPDATE SET
  title = EXCLUDED.title, author = EXCLUDED.author,
  edition_id = EXCLUDED.edition_id, source_revision = EXCLUDED.source_revision,
  fit_description = EXCLUDED.fit_description,
  decision_criterion = EXCLUDED.decision_criterion, active = TRUE;\n\n`);
  process.exit(0);
}

const connection = process.env.NEON_DATABASE_URL;
if (!connection) throw new Error('Set NEON_DATABASE_URL before seeding the catalog.');
const sql = neon(connection);
await sql`CREATE TABLE IF NOT EXISTS rise_books (
  work_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  edition_id TEXT NOT NULL CHECK (edition_id LIKE 'standard-ebooks:%' OR edition_id LIKE 'rise-original:%'),
  source_revision TEXT NOT NULL CHECK (source_revision ~ '^sha256:[0-9a-f]{64}$'),
  fit_description TEXT NOT NULL,
  decision_criterion TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
)`;
await sql`ALTER TABLE rise_books DROP CONSTRAINT IF EXISTS rise_books_edition_id_check`;
await sql`ALTER TABLE rise_books ADD CONSTRAINT rise_books_edition_id_check
  CHECK (edition_id LIKE 'standard-ebooks:%' OR edition_id LIKE 'rise-original:%')`;

for (const { workId, title, author, fit, criterion, edition } of CATALOG) {
  await sql`INSERT INTO rise_books
    (work_id, title, author, edition_id, source_revision, fit_description, decision_criterion, active)
    VALUES (${workId}, ${title}, ${author}, ${edition.editionId}, ${edition.sourceRevision}, ${fit}, ${criterion}, TRUE)
    ON CONFLICT (work_id) DO UPDATE SET
      title = EXCLUDED.title, author = EXCLUDED.author,
      edition_id = EXCLUDED.edition_id, source_revision = EXCLUDED.source_revision,
      fit_description = EXCLUDED.fit_description,
      decision_criterion = EXCLUDED.decision_criterion, active = TRUE`;
}

const count = await sql`SELECT count(*)::integer AS count FROM rise_books WHERE active = TRUE`;
if (count[0]?.count !== CATALOG.length) {
  throw new Error('Active catalog must contain exactly the released reading seed set.');
}
process.stdout.write(`Seeded ${count[0].count} released readings.\n`);
