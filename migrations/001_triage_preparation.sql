CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE raw_items
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS processed_run_id uuid REFERENCES nightly_runs(id) ON DELETE SET NULL;

UPDATE raw_items
SET processed_at = COALESCE(processed_at, now())
WHERE processed = true
  AND processed_at IS NULL;

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS run_id uuid REFERENCES nightly_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS raw_item_id uuid REFERENCES raw_items(id) ON DELETE SET NULL;

UPDATE candidates
SET raw_item_id = raw_item_ids[1]
WHERE raw_item_id IS NULL
  AND cardinality(raw_item_ids) = 1;

CREATE INDEX IF NOT EXISTS idx_raw_items_triage_claimable
  ON raw_items (fetched_at, id)
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_raw_items_processed_run_id
  ON raw_items (processed_run_id)
  WHERE processed_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidates_run_id
  ON candidates (run_id);

CREATE INDEX IF NOT EXISTS idx_candidates_raw_item_id
  ON candidates (raw_item_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_candidates_raw_item_id_unique
  ON candidates (raw_item_id)
  WHERE raw_item_id IS NOT NULL;
