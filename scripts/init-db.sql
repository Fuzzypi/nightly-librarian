-- Base schema for nightly_librarian
-- Run once on a fresh database before migrations.

CREATE TABLE IF NOT EXISTS nightly_runs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status                text NOT NULL DEFAULT 'running',
  notes                 text,
  error_log             text,
  private_memo          text,
  items_triaged         integer,
  items_scored          integer,
  items_rejected        integer,
  items_published       integer,
  raw_items_fetched     integer,
  triage_completed_at   timestamptz,
  evidence_completed_at timestamptz,
  editor_completed_at   timestamptz,
  started_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz
);

CREATE TABLE IF NOT EXISTS sources (
  id          text PRIMARY KEY,
  source_type text NOT NULL,
  url         text NOT NULL,
  enabled     boolean NOT NULL DEFAULT true,
  priority    integer NOT NULL DEFAULT 5,
  tier        integer NOT NULL DEFAULT 2
);

CREATE TABLE IF NOT EXISTS raw_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       text NOT NULL REFERENCES sources(id),
  external_id     text NOT NULL,
  title           text,
  url             text,
  content         text,
  raw_data        jsonb,
  published_at    timestamptz,
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  processed       boolean NOT NULL DEFAULT false,
  processed_at    timestamptz,
  processed_run_id uuid REFERENCES nightly_runs(id) ON DELETE SET NULL,
  UNIQUE (source_id, external_id)
);

CREATE TABLE IF NOT EXISTS candidates (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                    uuid REFERENCES nightly_runs(id) ON DELETE SET NULL,
  raw_item_id               uuid REFERENCES raw_items(id) ON DELETE SET NULL,
  raw_item_ids              uuid[],
  source_ids                text[],
  title                     text,
  summary                   text,
  raw_claim                 text,
  category                  text,
  evidence_level            text,
  evidence_sources          text[],
  uncertainty               text,
  worth_mentioning_reason   text,
  score_worth_mentioning    numeric,
  score_solo_dev_relevance  numeric,
  score_owner_work_relevance numeric,
  score_future_work_relevance numeric,
  score_decision_impact     numeric,
  score_evidence_strength   numeric,
  score_cost_time_leverage  numeric,
  score_risk_reduction      numeric,
  score_business_opportunity numeric,
  score_hype_risk           numeric,
  score_novelty_penalty     numeric,
  verdict                   text,
  verdict_reason            text,
  scored_at                 timestamptz
);

CREATE TABLE IF NOT EXISTS fetch_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       uuid REFERENCES nightly_runs(id) ON DELETE SET NULL,
  source_id    text REFERENCES sources(id),
  status       text NOT NULL DEFAULT 'running',
  items_found  integer,
  items_new    integer,
  error_log    text,
  started_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Seed sources (Tier 1 official + Tier 2 community)
INSERT INTO sources (id, source_type, url, enabled, priority, tier) VALUES
  ('openai-blog',        'rss',            'https://openai.com/blog/rss.xml',                           true, 10, 1),
  ('anthropic-blog',     'rss',            'https://www.anthropic.com/rss.xml',                          true, 10, 1),
  ('google-ai-blog',     'rss',            'https://blog.google/technology/ai/rss/',                     true, 10, 1),
  ('mistral-blog',       'rss',            'https://mistral.ai/news/rss',                                true,  9, 1),
  ('github-blog',        'rss',            'https://github.blog/feed/',                                  true,  8, 1),
  ('huggingface-blog',   'rss',            'https://huggingface.co/blog/feed.xml',                       true,  8, 1),
  ('vercel-changelog',   'rss',            'https://vercel.com/changelog/rss.xml',                       true,  7, 1),
  ('ollama-releases',    'github_release', 'ollama/ollama',                                              true,  7, 1),
  ('langchain-blog',     'rss',            'https://blog.langchain.dev/rss/',                            true,  6, 1),
  ('simon-willison',     'rss',            'https://simonwillison.net/atom/everything/',                 true,  7, 2),
  ('hn-top',             'hn_api',         'https://hacker-news.firebaseio.com/v0/topstories.json',      true,  6, 2),
  ('reddit-localllama',  'reddit_json',    'https://www.reddit.com/r/LocalLLaMA/new.json',               true,  5, 2),
  ('reddit-saas',        'reddit_json',    'https://www.reddit.com/r/SaaS/new.json',                     true,  4, 2),
  ('lobsters',           'rss',            'https://lobste.rs/t/ai.rss',                                 true,  4, 2),
  ('claude-status',      'rss',            'https://status.anthropic.com/history.rss',                   true,  8, 1)
ON CONFLICT (id) DO NOTHING;
