
CREATE TABLE bob_closed_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework text NOT NULL,
  exam_part text NOT NULL,
  cefr_level text,
  variant_id text NOT NULL,
  stimulus_audio_url text,
  stimulus_text text,
  stimulus_image_url text,
  question text NOT NULL,
  options jsonb NOT NULL,
  correct_key text NOT NULL,
  explanation text,
  source text NOT NULL DEFAULT 'curated' CHECK (source IN ('curated','official','generated_then_curated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (framework, exam_part, cefr_level, variant_id)
);
CREATE INDEX bob_closed_items_lookup_idx ON bob_closed_items(framework, exam_part, cefr_level);
ALTER TABLE bob_closed_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read closed items" ON bob_closed_items
  FOR SELECT TO authenticated USING (true);
COMMENT ON TABLE bob_closed_items IS 'Banco de ítems de comprensión cerrada (Listening/Reading multiple-choice). Curado, no generado por LLM. D9-2.';
