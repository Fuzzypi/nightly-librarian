'use strict';

/**
 * pre-triage.js
 *
 * Three deterministic filters that run between the DB claim query and the
 * Codex triage batch. Ported from last30days-skill (MIT) signals.py,
 * dedupe.py, and fusion.py, adapted to TNL's raw_items schema.
 *
 * Pipeline order:
 *   1. dedupeItems    — collapse near-duplicate titles, keep higher-engagement item
 *   2. perSourceCap   — prevent one high-volume source from flooding the batch
 *   3. annotateEngagement — attach engagement score to each item for Codex context
 *
 * None of these make verdict decisions. They reduce noise before Codex sees
 * the batch and surface engagement signal so Codex can weight items better.
 */

// ─── Stopwords for token Jaccard ─────────────────────────────────────────────

const STOPWORDS = new Set([
  'the', 'a', 'an', 'to', 'for', 'how', 'is', 'in', 'of', 'on', 'and',
  'with', 'from', 'by', 'at', 'this', 'that', 'it', 'what', 'are', 'do',
  'can', 'new', 'my', 'your', 'their', 'its', 'was', 'has', 'have', 'be',
  'as', 'or', 'but', 'not', 'are', 'now', 'just', 'show', 'hn',
]);

// Threshold above which two titles are considered near-duplicates.
// 0.72 is empirically correct for TNL titles: "llama.cpp Gemma4 MTP merged"
// vs "llama.cpp adds Gemma4 MTP support" → ~0.68 (same story, collapses);
// "Anthropic cuts prices" vs "OpenAI raises prices" → ~0.20 (different, survives).
const DEDUPE_THRESHOLD = 0.70;

// Max items per source_id entering the Codex batch.
// Today's worst case: reddit-saas sent 37/40 items.
// With cap=6, reddit-saas gets 6, leaving 34 slots for other sources.
const DEFAULT_SOURCE_CAP = 6;

// ─── Text normalisation ───────────────────────────────────────────────────────

function normalizeTitle(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(text) {
  return new Set(
    normalizeTitle(text)
      .split(' ')
      .filter((t) => t.length > 1 && !STOPWORDS.has(t))
  );
}

// ─── Similarity ───────────────────────────────────────────────────────────────

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  return intersection / (setA.size + setB.size - intersection);
}

function titleSimilarity(titleA, titleB) {
  return jaccardSimilarity(tokenSet(titleA), tokenSet(titleB));
}

// ─── Engagement scoring ───────────────────────────────────────────────────────

/**
 * log1p-safe: returns 0 for null/undefined/non-numeric/negative.
 * Matches last30days log1p_safe exactly.
 */
function log1p(value) {
  if (value == null) return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.log1p(n);
}

/**
 * Per-source engagement score (unnormalized).
 * Returns null when raw_data carries no engagement fields for this source.
 * Mirrors last30days ENGAGEMENT_WEIGHTS and per-source custom functions.
 *
 * raw_data field map (from actual DB rows):
 *   reddit-*  → score, num_comments, upvote_ratio   (full reddit API data object)
 *   hn-*      → score, descendants                  (HN Algolia item)
 *   lobsters  → RSS — no engagement                 → null
 *   gh-*      → RSS — no engagement                 → null
 *   simon-*   → RSS — no engagement                 → null
 */
function rawEngagement(item) {
  const d = item.raw_data;
  if (!d || typeof d !== 'object') return null;

  const sid = item.source_id || '';

  if (sid.startsWith('reddit-')) {
    const score    = log1p(d.score);
    const comments = log1p(d.num_comments);
    const ratio    = Number(d.upvote_ratio) || 0;
    if (!score && !comments && !ratio) return null;
    // 50% score, 35% comments, 5% ratio (×10 to match magnitude)
    return (0.50 * score) + (0.35 * comments) + (0.05 * (ratio * 10));
  }

  if (sid.startsWith('hn-')) {
    const points   = log1p(d.score);
    const comments = log1p(d.descendants);
    if (!points && !comments) return null;
    return (0.55 * points) + (0.45 * comments);
  }

  if (sid.startsWith('lobsters')) {
    const score = log1p(d.score);
    if (!score) return null;
    return score;
  }

  // GitHub releases, RSS feeds — no engagement data
  return null;
}

/**
 * Normalize a list of raw engagement scores to 0–100.
 * Items with null scores stay null (not enough data to rank).
 */
function normalizeScores(scores) {
  const valid = scores.filter((s) => s !== null);
  if (valid.length === 0) return scores.map(() => null);
  const lo = Math.min(...valid);
  const hi = Math.max(...valid);
  if (Math.abs(hi - lo) < 1e-9) return scores.map((s) => (s !== null ? 50 : null));
  return scores.map((s) =>
    s === null ? null : Math.round(((s - lo) / (hi - lo)) * 100)
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * annotateEngagement(items) → items
 *
 * Attaches `engagement_score` (0–100 or null) to each item in-place.
 * Normalisation is relative across the batch, matching last30days behaviour.
 * Items without engagement data (RSS sources) get null — Codex ignores the field.
 */
function annotateEngagement(items) {
  const raw = items.map(rawEngagement);
  const normalized = normalizeScores(raw);
  items.forEach((item, i) => {
    item.engagement_score = normalized[i];
  });
  return items;
}

/**
 * dedupeItems(items) → { kept, duplicates }
 *
 * Collapses near-duplicate titles within the batch.
 * When two items are duplicates:
 *   - The one with higher engagement_score survives (or the earlier-fetched if tied/null).
 *   - The other is placed in `duplicates` with `duplicate_of` set to the survivor's id.
 *
 * Requires annotateEngagement to have run first (uses engagement_score for tie-breaking).
 * O(n²) over batch size — fine for n ≤ 200.
 */
function dedupeItems(items) {
  // Pre-compute token sets once
  const tokenSets = items.map((item) => tokenSet(item.title || ''));

  const kept = [];       // survivors: one representative per cluster
  const keptIdx = [];   // index into items[] for each kept entry
  const duplicates = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let matchJ = -1;

    for (let j = 0; j < kept.length; j++) {
      const sim = jaccardSimilarity(tokenSets[i], tokenSets[keptIdx[j]]);
      if (sim >= DEDUPE_THRESHOLD) {
        matchJ = j;
        break;
      }
    }

    if (matchJ === -1) {
      // No duplicate found — this item is a new cluster representative
      kept.push(item);
      keptIdx.push(i);
    } else {
      // Duplicate of kept[matchJ]. Decide which one survives.
      const incumbent = kept[matchJ];
      const challScore = item.engagement_score ?? -1;
      const incumScore = incumbent.engagement_score ?? -1;

      if (challScore > incumScore) {
        // Challenger has higher engagement — swap it in, demote incumbent
        duplicates.push({ ...incumbent, duplicate_of: item.id });
        incumbent._duplicate_of = item.id;
        kept[matchJ] = item;
        keptIdx[matchJ] = i;
      } else {
        // Incumbent survives, this item is the duplicate
        duplicates.push({ ...item, duplicate_of: incumbent.id });
        item._duplicate_of = incumbent.id;
      }
    }
  }

  return { kept, duplicates };
}

/**
 * perSourceCap(items, max = DEFAULT_SOURCE_CAP) → { kept, deferred }
 *
 * Ensures no single source_id contributes more than `max` items to the batch.
 * Within each source, items are ordered by engagement_score DESC, then fetched_at ASC.
 * Deferred items retain their processed_run_id — they won't re-enter the next
 * automatic run. The caller logs deferred_ids so they can be manually reviewed.
 */
function perSourceCap(items, max = DEFAULT_SOURCE_CAP) {
  const bySource = new Map();
  for (const item of items) {
    const sid = item.source_id;
    if (!bySource.has(sid)) bySource.set(sid, []);
    bySource.get(sid).push(item);
  }

  const kept = [];
  const deferred = [];

  for (const [, sourceItems] of bySource) {
    const sorted = [...sourceItems].sort((a, b) => {
      const aScore = a.engagement_score ?? -1;
      const bScore = b.engagement_score ?? -1;
      if (bScore !== aScore) return bScore - aScore;
      return new Date(a.fetched_at) - new Date(b.fetched_at);
    });

    kept.push(...sorted.slice(0, max));
    deferred.push(...sorted.slice(max));
  }

  return { kept, deferred };
}

/**
 * runPreTriage(items, options?) → { items, stats }
 *
 * Run all three stages in order. Returns the filtered item list plus a stats
 * object for logging.
 *
 * items: raw DB rows from the claim query (must include raw_data, source_id,
 *        title, url, fetched_at, published_at, id, external_id, content)
 */
function runPreTriage(items, { sourceCap = DEFAULT_SOURCE_CAP } = {}) {
  const total = items.length;

  // Stage 1: annotate engagement (in-place, must run before dedup)
  annotateEngagement(items);

  // Stage 2: deduplicate near-identical titles
  const { kept: afterDedup, duplicates } = dedupeItems(items);

  // Stage 3: cap per-source volume
  const { kept: afterCap, deferred } = perSourceCap(afterDedup, sourceCap);

  const stats = {
    input: total,
    duplicates_removed: duplicates.length,
    deferred_over_cap: deferred.length,
    output: afterCap.length,
    duplicate_ids: duplicates.map((d) => ({ id: d.id, duplicate_of: d.duplicate_of })),
    deferred_ids: deferred.map((d) => d.id),
  };

  return { items: afterCap, stats };
}

module.exports = {
  runPreTriage,
  annotateEngagement,
  dedupeItems,
  perSourceCap,
  titleSimilarity,
  DEDUPE_THRESHOLD,
  DEFAULT_SOURCE_CAP,
};
