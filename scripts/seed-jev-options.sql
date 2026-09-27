-- Run after deploying the matching renderer and Worker allowlists.
-- Sound choices live in rise_sounds. This menu governs only type choices.
-- This menu can disable supported choices; descriptions are reviewed metadata,
-- not model instructions. It cannot create a new renderer feature.
CREATE TABLE IF NOT EXISTS rise_jev_options (
  kind TEXT NOT NULL CHECK (kind IN ('chamberFace', 'fontSize')),
  id TEXT NOT NULL,
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 240),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (kind, id),
  CHECK (
    (kind = 'chamberFace' AND id IN ('literary', 'display', 'thick', 'mono', 'jp', 'sans', 'book')) OR
    (kind = 'fontSize' AND id IN ('small', 'medium', 'large', 'xlarge', 'fit'))
  )
);

-- Existing installations retain their original CHECK after CREATE IF NOT EXISTS.
ALTER TABLE public.rise_jev_options DROP CONSTRAINT IF EXISTS rise_jev_options_check;
ALTER TABLE public.rise_jev_options ADD CONSTRAINT rise_jev_options_check CHECK (
  (kind = 'chamberFace' AND id IN ('literary', 'display', 'thick', 'mono', 'jp', 'sans', 'book')) OR
  (kind = 'fontSize' AND id IN ('small', 'medium', 'large', 'xlarge', 'fit'))
);

INSERT INTO rise_jev_options (kind, id, description, active) VALUES
  ('chamberFace', 'literary', 'Literary serif letterforms for prose and classic reading.', TRUE),
  ('chamberFace', 'display', 'Display serif letterforms for a formal, monumental tone.', TRUE),
  ('chamberFace', 'thick', 'Bold geometric letterforms for strong, vivid readings.', TRUE),
  ('chamberFace', 'mono', 'Evenly spaced monospaced letterforms for technical, archival, or machine-like tone.', TRUE),
  ('chamberFace', 'jp', 'Japanese serif letterforms for Japanese-language text.', TRUE),
  ('chamberFace', 'sans', 'Clean regular sans letterforms for modern or minimal reading.', TRUE),
  ('chamberFace', 'book', 'Stronger book serif letterforms for readable emphasis.', TRUE),
  ('fontSize', 'small', 'Small text for a dense, restrained field.', TRUE),
  ('fontSize', 'medium', 'Medium text for balanced reading.', TRUE),
  ('fontSize', 'large', 'Large text for emphatic or accessible reading.', TRUE),
  ('fontSize', 'xlarge', 'Extra large text for strong emphasis or easier reading at a distance.', TRUE),
  ('fontSize', 'fit', 'Fit each word to the Chamber; choose only with one-word chunks.', TRUE)
ON CONFLICT (kind, id) DO UPDATE SET description = EXCLUDED.description;

GRANT SELECT ON TABLE public.rise_jev_options TO rise_catalog_app;
