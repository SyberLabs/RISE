-- Jev offers these IDs only when the matching soundscapes ship in the client.
-- Store choice metadata here; audio is synthesized in the browser, not stored as a blob.
CREATE TABLE IF NOT EXISTS rise_sounds (
  sound_id TEXT PRIMARY KEY,
  decision_criterion TEXT NOT NULL CHECK (length(decision_criterion) BETWEEN 10 AND 120),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO rise_sounds (sound_id, decision_criterion, active) VALUES
  ('aurora', 'Soft, spacious harmonics for calm, hopeful, or reflective reading.', TRUE),
  ('faded-signal', 'Weathered, nostalgic ambience for memory or bittersweet reflection.', TRUE),
  ('soft-rain', 'Locally synthesized unpitched rain for a rainy, sheltered, or nature-focused reading.', TRUE),
  ('sad', 'Slow minor harmony for grief, loneliness, or melancholy.', TRUE),
  ('angry', 'Tense, rough harmony for anger, conflict, or defiance.', TRUE),
  ('happy', 'Warm major harmony for joy, ease, or celebration.', TRUE),
  ('excited', 'Bright moving harmony for anticipation and high energy.', TRUE),
  ('thrilling', 'Driving low pulse for suspense, pursuit, or dramatic momentum.', TRUE),
  ('scary', 'Uneasy low dissonance for dread, fear, or ominous scenes.', TRUE),
  ('piano', 'Gentle piano melody for intimate, tender, or reflective reading.', TRUE),
  ('jazz', 'Swung jazz piano and walking bass for lively or sophisticated reading.', TRUE),
  ('lullaby', 'A soft, rocking keyboard lullaby for comfort, bedtime, and gentle care.', TRUE),
  ('nocturne', 'A quiet night piece for solitude, longing, and inward reflection.', TRUE),
  ('waltz', 'A lilting three-beat keyboard waltz for romance, grace, or nostalgia.', TRUE),
  ('blues', 'A relaxed blues keyboard groove for resilience, wit, or bittersweet warmth.', TRUE),
  ('bossa', 'A light syncopated bossa keyboard rhythm for warmth, travel, or ease.', TRUE),
  ('ragtime', 'A brisk, playful ragtime keyboard piece for mischief and buoyant energy.', TRUE),
  ('wonder', 'A spacious rising synth theme for discovery, awe, and possibility.', TRUE),
  ('mystery', 'A sparse, questioning synth theme for secrets and investigation.', TRUE),
  ('chase', 'A driving electronic pulse for pursuit, urgency, and action.', TRUE),
  ('triumph', 'A bold resolving synth theme for victory and earned celebration.', TRUE),
  ('haunted', 'A fragile dissonant theme for eerie, ghostly, or uncanny scenes.', TRUE),
  ('starlight', 'A slow shimmering synth theme for cosmic calm and night skies.', TRUE)
ON CONFLICT (sound_id) DO UPDATE SET
  decision_criterion = EXCLUDED.decision_criterion,
  active = EXCLUDED.active;

GRANT SELECT ON TABLE public.rise_sounds TO rise_catalog_app;
