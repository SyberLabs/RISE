CREATE TABLE IF NOT EXISTS rise_books (
  work_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  edition_id TEXT NOT NULL CHECK (edition_id LIKE 'standard-ebooks:%'),
  source_revision TEXT NOT NULL CHECK (source_revision ~ '^sha256:[0-9a-f]{64}$'),
  fit_description TEXT NOT NULL,
  decision_criterion TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO rise_books
  (work_id, title, author, edition_id, source_revision, fit_description, decision_criterion, active)
VALUES
  ('middlemarch', 'Middlemarch', 'George Eliot', 'standard-ebooks:george-eliot/middlemarch', 'sha256:8fe93ecab80ada30e4d1bb77122e6033b27f802ab9e131b6d128bb82448297ba', 'A rich novel of relationships, ambition, and life in a provincial town.', 'Choose for a reader seeking a long, psychologically detailed social novel about relationships, choices, and community.', TRUE),
  ('the-brothers-karamazov', 'The Brothers Karamazov', 'Fyodor Dostoevsky', 'standard-ebooks:fyodor-dostoevsky/the-brothers-karamazov_constance-garnett', 'sha256:26ecd0f8e0d6db4dffb039f0fb96cbf912f8b91b8bd6bc4a8846a1bef8da4b4f', 'A searching family novel about faith, conflict, and moral responsibility.', 'Choose for a reader seeking an intense, philosophical family drama about faith, guilt, and moral responsibility.', TRUE),
  ('literary-meditations', 'Meditations', 'Marcus Aurelius', 'standard-ebooks:marcus-aurelius/meditations_george-long', 'sha256:1d5c3e8ca1cd6b9b98731ebc034a6408eea84b2642525844cd4e04f9445a2418', 'Brief Stoic reflections on attention, conduct, and inner steadiness.', 'Choose for a reader seeking short, reflective philosophy about discipline, conduct, or calm.', TRUE),
  ('sacred-tao-te-ching', 'Tao Te Ching', 'Laozi', 'standard-ebooks:laozi/tao-te-ching_james-legge', 'sha256:93a404f327f00124bb7363149d5a628554b4aee72d5140d7108249398dcba7f9', 'Compact poetic sayings about balance, humility, and the way.', 'Choose for a reader seeking concise philosophical or spiritual sayings about balance and simplicity.', TRUE),
  ('the-iliad', 'The Iliad', 'Homer', 'standard-ebooks:homer/the-iliad_william-cullen-bryant', 'sha256:0695d06ded3af9669b8f314f1ae76e8186b1d67e81b6a726992a8c5ed88cf143', 'A war epic about honor, anger, loss, and human limits.', 'Choose for a reader seeking an ancient heroic epic about war, anger, honor, and grief.', TRUE),
  ('the-divine-comedy', 'The Divine Comedy', 'Dante Alighieri', 'standard-ebooks:dante-alighieri/the-divine-comedy_henry-wadsworth-longfellow', 'sha256:e46df1aad0df16c7632e589626b3d133cc30a32233ccb548f90eb9df1383625c', 'An imaginative verse journey through the afterlife and moral consequence.', 'Choose for a reader seeking allegorical epic poetry, spiritual journey, or medieval imagination.', TRUE),
  ('metamorphoses', 'Metamorphoses', 'Ovid', 'standard-ebooks:ovid/metamorphoses_various-translators', 'sha256:6878e143e0db80039364eb328b65a33faf2c1a43a67696d74920c5a17a5bd17a', 'Mythic stories of creation, desire, and transformation.', 'Choose for a reader seeking classical mythology, vivid narrative poetry, or stories about transformation.', TRUE),
  ('spoon-river-anthology', 'Spoon River Anthology', 'Edgar Lee Masters', 'standard-ebooks:edgar-lee-masters/spoon-river-anthology', 'sha256:c017904d7f16ac841dce0b600de8e8c0eb121954e3935d34c8ac44ce23b68834', 'Short first-person poems revealing the lives of an American town.', 'Choose for a reader seeking short poems, distinct voices, or intimate stories of ordinary lives.', TRUE),
  ('oedipus-rex', 'Oedipus Rex', 'Sophocles', 'standard-ebooks:sophocles/oedipus-rex_francis-storr', 'sha256:eb2e082803731ad073425e03cc59d2c1ec8dbf1b257510838582136c0341e53e', 'A compact Greek tragedy about truth, fate, and self-knowledge.', 'Choose for a reader seeking a short dramatic tragedy about fate, truth, and self-discovery.', TRUE),
  ('literary-walden', 'Walden', 'Henry David Thoreau', 'standard-ebooks:henry-david-thoreau/walden', 'sha256:3d8f22b6e22bbc61799a08d5d37e8a168e1ccef43f7df60b61edca53bfc90117', 'Observations on nature, solitude, and deliberate living.', 'Choose for a reader seeking nature writing, solitude, self-reliance, or reflective nonfiction.', TRUE),
  ('ulysses', 'Ulysses', 'James Joyce', 'standard-ebooks:james-joyce/ulysses', 'sha256:14f18abbee5b184493bc4b4356054f1767c3904d59c1653d896f294bf0691d85', 'An experimental day-long journey through Dublin and consciousness.', 'Choose for a reader seeking challenging modernist fiction, language experiments, or urban interior life.', TRUE),
  ('paradise-lost', 'Paradise Lost', 'John Milton', 'standard-ebooks:john-milton/paradise-lost', 'sha256:e1f747c0f0e2d1b13433f6b2f51c9be28e53fe496c0ebb11904b8ef0c26c467e', 'A blank-verse epic about rebellion, temptation, and the Fall.', 'Choose for a reader seeking English epic poetry about myth, theology, rebellion, and temptation.', TRUE),
  ('literary-essays-emerson', 'Essays', 'Ralph Waldo Emerson', 'standard-ebooks:ralph-waldo-emerson/essays', 'sha256:54315365d0f668f414e4a115566332406e4c43b3fe9c8088931fcb629886cca3', 'Arguments for self-reliance, nature, and intellectual independence.', 'Choose for a reader seeking philosophical essays about self-reliance, individuality, or nature.', TRUE),
  ('confucius-analects', 'The Analects', 'Confucius', 'standard-ebooks:confucius/analects_james-legge', 'sha256:07a1a0df72a27ea7ab2dd96072d6ac9498b01bc4b1008b02464c14395dc3dc13', 'Short teachings on learning, character, and social responsibility.', 'Choose for a reader seeking brief ethical teachings about learning, conduct, and community.', TRUE),
  ('lyrical-ballads', 'Lyrical Ballads', 'William Wordsworth and Samuel Taylor Coleridge', 'standard-ebooks:william-wordsworth/samuel-taylor-coleridge_lyrical-ballads', 'sha256:24576576e9f5b402ff5c2b004c8888b5445f56e89ce9e9a52dca9c33636612d5', 'Romantic poems of landscape, memory, and everyday life.', 'Choose for a reader seeking Romantic lyric poetry, landscape, memory, or emotional reflection.', TRUE)
ON CONFLICT (work_id) DO UPDATE SET
  title = EXCLUDED.title, author = EXCLUDED.author,
  edition_id = EXCLUDED.edition_id, source_revision = EXCLUDED.source_revision,
  fit_description = EXCLUDED.fit_description,
  decision_criterion = EXCLUDED.decision_criterion, active = TRUE;

