-- LMS Public API key management
CREATE TABLE IF NOT EXISTS api_keys (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  key_hash          VARCHAR(64) NOT NULL UNIQUE,
  name              TEXT        NOT NULL,
  scopes            TEXT[]      NOT NULL DEFAULT '{}',
  last_used_at      TIMESTAMPTZ,
  rate_window_start TIMESTAMPTZ,
  rate_window_count INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS api_keys_professor_id_idx ON api_keys (professor_id);
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx     ON api_keys (key_hash);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "professors_own_api_keys" ON api_keys
  FOR ALL USING (auth.uid() = professor_id);
