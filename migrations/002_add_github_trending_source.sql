-- Migration 002: Add GitHub trending source
-- Fetches weekly trending repos relevant to solo developers via GitHub Search API.
-- source_type = 'github_trending'
-- url encodes the window: 'daily' | 'weekly' | 'monthly'

INSERT INTO sources (id, source_type, url, enabled, priority, tier)
VALUES ('github-trending-weekly', 'github_trending', 'weekly', true, 7, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('002') ON CONFLICT DO NOTHING;
