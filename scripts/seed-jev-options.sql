-- Run after deploying the matching renderer and Worker allowlists.
-- This menu can disable or describe supported choices; it cannot create a new renderer feature.
CREATE TABLE IF NOT EXISTS rise_jev_options (
  kind TEXT NOT NULL CHECK (kind IN ('audio', 'chamberFace', 'fontSize')),
  id TEXT NOT NULL,
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 240),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (kind, id),
  CHECK (
    (kind = 'audio' AND id IN ('silent', 'aurora', 'faded-signal', 'soft-rain')) OR
    (kind = 'chamberFace' AND id IN ('literary', 'display', 'thick', 'mono', 'jp')) OR
    (kind = 'fontSize' AND id IN ('small', 'medium', 'large', 'fit'))
  )
);

INSERT INTO rise_jev_options (kind, id, description, active) VALUES
  ('audio', 'silent', 'Silence; choose when the reader asks for quiet or no sound.', TRUE),
  ('audio', 'aurora', 'Slow harmonic pad and wandering tones; choose for spacious, meditative atmosphere.', TRUE),
  ('audio', 'faded-signal', 'Weathered analog harmony with tape drift; choose for nostalgic or imperfect warmth.', TRUE),
  ('audio', 'soft-rain', 'Locally synthesized, unpitched rain texture; choose for rainy or nature atmosphere without melody.', TRUE),
  ('chamberFace', 'literary', 'Literary serif letterforms for prose and classic reading.', TRUE),
  ('chamberFace', 'display', 'Display serif letterforms for a formal, monumental tone.', TRUE),
  ('chamberFace', 'thick', 'Bold geometric letterforms for strong, vivid readings.', TRUE),
  ('chamberFace', 'mono', 'Evenly spaced monospaced letterforms for technical, archival, or machine-like tone.', TRUE),
  ('chamberFace', 'jp', 'Japanese serif letterforms for Japanese-language text.', TRUE),
  ('fontSize', 'small', 'Small text for a dense, restrained field.', TRUE),
  ('fontSize', 'medium', 'Medium text for balanced reading.', TRUE),
  ('fontSize', 'large', 'Large text for emphatic or accessible reading.', TRUE),
  ('fontSize', 'fit', 'Fit each word to the Chamber; choose only with one-word chunks.', TRUE)
ON CONFLICT (kind, id) DO UPDATE SET description = EXCLUDED.description;
