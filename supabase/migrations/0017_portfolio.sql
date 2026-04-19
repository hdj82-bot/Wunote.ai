-- Portfolio snapshots cache
CREATE TABLE IF NOT EXISTS portfolios (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot      JSONB       NOT NULL
);

CREATE INDEX IF NOT EXISTS portfolios_student_id_idx ON portfolios (student_id);
CREATE INDEX IF NOT EXISTS portfolios_generated_at_idx ON portfolios (generated_at DESC);

-- RLS: students can only read their own portfolios
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_own_portfolios" ON portfolios
  FOR ALL USING (auth.uid() = student_id);
