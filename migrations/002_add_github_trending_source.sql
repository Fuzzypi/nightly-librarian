-- Migration 002: Add GitHub trending source
-- Fetches weekly trending repos via GitHub Search API.

-- 1. Extend source_type check to allow github_trending
ALTER TABLE sources DROP CONSTRAINT IF EXISTS sources_source_type_check;
ALTER TABLE sources ADD CONSTRAINT sources_source_type_check
  CHECK (source_type = ANY (ARRAY[
    'rss','github_release','hn_api','reddit_json','scrape','api','manual','github_trending'
  ]));

-- 2. Insert the source row
INSERT INTO sources (id, name, source_type, url, enabled, priority, tier)
VALUES ('github-trending-weekly', 'GitHub Trending Weekly', 'github_trending', 'weekly', true, 'medium', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('002') ON CONFLICT DO NOTHING;
