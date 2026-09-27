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
  ('scary', 'Uneasy low dissonance for dread, fear, or ominous scenes.', TRUE)
ON CONFLICT (sound_id) DO UPDATE SET
  decision_criterion = EXCLUDED.decision_criterion,
  active = EXCLUDED.active;

GRANT SELECT ON TABLE public.rise_sounds TO rise_catalog_app;
