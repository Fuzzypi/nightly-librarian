const logger = require('./utils/logger');

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_BATCH_LIMIT = 25;
const CLAIM_STALE_AFTER_HOURS = 2;

const CATEGORIES = [
  'model_change',
  'api_platform_change',
  'agent_workflow',
  'open_source',
  'infrastructure',
  'voice_agents',
  'data_scraping',
  'automation',
  'security_risk',
  'pricing_cost',
  'distribution',
  'solo_business',
  'builder_report',
];

const EVIDENCE_LEVELS = [
  'vendor_claim',
  'early_signal',
  'builder_reported',
  'reproducible',
  'production_proven',
];

const VERDICTS = ['publish_public', 'publish_private', 'monitor', 'reject'];

const SCORE_FIELDS = [
  'score_worth_mentioning',
  'score_solo_dev_relevance',
  'score_owner_work_relevance',
  'score_future_work_relevance',
  'score_decision_impact',
  'score_evidence_strength',
  'score_cost_time_leverage',
  'score_risk_reduction',
  'score_business_opportunity',
  'score_hype_risk',
  'score_novelty_penalty',
];

const INSERT_CANDIDATE = `
  INSERT INTO candidates (
    run_id,
    raw_item_id,
    raw_item_ids,
    source_ids,
    title,
    summary,
    raw_claim,
    category,
    evidence_level,
    evidence_sources,
    uncertainty,
    worth_mentioning_reason,
    score_worth_mentioning,
    score_solo_dev_relevance,
    score_owner_work_relevance,
    score_future_work_relevance,
    score_decision_impact,
    score_evidence_strength,
    score_cost_time_leverage,
    score_risk_reduction,
    score_business_opportunity,
    score_hype_risk,
    score_novelty_penalty,
    verdict,
    verdict_reason,
    scored_at
  )
  VALUES (
    $1, $2, ARRAY[$2]::uuid[], ARRAY[$3]::text[], $4, $5, $6, $7, $8, $9::text[], $10, $11,
    $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, now()
  )
  ON CONFLICT (raw_item_id) WHERE raw_item_id IS NOT NULL DO UPDATE
  SET run_id = EXCLUDED.run_id,
      raw_item_ids = EXCLUDED.raw_item_ids,
      source_ids = EXCLUDED.source_ids,
      title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      raw_claim = EXCLUDED.raw_claim,
      category = EXCLUDED.category,
      evidence_level = EXCLUDED.evidence_level,
      evidence_sources = EXCLUDED.evidence_sources,
      uncertainty = EXCLUDED.uncertainty,
      worth_mentioning_reason = EXCLUDED.worth_mentioning_reason,
      score_worth_mentioning = EXCLUDED.score_worth_mentioning,
      score_solo_dev_relevance = EXCLUDED.score_solo_dev_relevance,
      score_owner_work_relevance = EXCLUDED.score_owner_work_relevance,
      score_future_work_relevance = EXCLUDED.score_future_work_relevance,
      score_decision_impact = EXCLUDED.score_decision_impact,
      score_evidence_strength = EXCLUDED.score_evidence_strength,
      score_cost_time_leverage = EXCLUDED.score_cost_time_leverage,
      score_risk_reduction = EXCLUDED.score_risk_reduction,
      score_business_opportunity = EXCLUDED.score_business_opportunity,
      score_hype_risk = EXCLUDED.score_hype_risk,
      score_novelty_penalty = EXCLUDED.score_novelty_penalty,
      verdict = EXCLUDED.verdict,
      verdict_reason = EXCLUDED.verdict_reason,
      scored_at = now()
`;

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['private_memo', 'results'],
  properties: {
    private_memo: {
      type: 'string',
      description: 'A concise private markdown memo for the morning reader.',
    },
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'raw_item_id',
          'title',
          'summary',
          'raw_claim',
          'category',
          'evidence_level',
          'evidence_sources',
          'uncertainty',
          'worth_mentioning_reason',
          'score_worth_mentioning',
          'score_solo_dev_relevance',
          'score_owner_work_relevance',
          'score_future_work_relevance',
          'score_decision_impact',
          'score_evidence_strength',
          'score_cost_time_leverage',
          'score_risk_reduction',
          'score_business_opportunity',
          'score_hype_risk',
          'score_novelty_penalty',
          'verdict',
          'verdict_reason',
        ],
        properties: {
          raw_item_id: { type: 'string' },
          title: { type: 'string' },
          summary: { type: 'string' },
          raw_claim: { type: 'string' },
          category: { type: 'string', enum: CATEGORIES },
          evidence_level: { type: 'string', enum: EVIDENCE_LEVELS },
          evidence_sources: { type: 'array', items: { type: 'string' } },
          uncertainty: { type: 'string' },
          worth_mentioning_reason: { type: 'string' },
          score_worth_mentioning: { type: 'number', minimum: 0, maximum: 5 },
          score_solo_dev_relevance: { type: 'number', minimum: 0, maximum: 5 },
          score_owner_work_relevance: { type: 'number', minimum: 0, maximum: 5 },
          score_future_work_relevance: { type: 'number', minimum: 0, maximum: 5 },
          score_decision_impact: { type: 'number', minimum: 0, maximum: 5 },
          score_evidence_strength: { type: 'number', minimum: 0, maximum: 5 },
          score_cost_time_leverage: { type: 'number', minimum: 0, maximum: 5 },
          score_risk_reduction: { type: 'number', minimum: 0, maximum: 5 },
          score_business_opportunity: { type: 'number', minimum: 0, maximum: 5 },
          score_hype_risk: { type: 'number', minimum: 0, maximum: 5 },
          score_novelty_penalty: { type: 'number', minimum: 0, maximum: 5 },
          verdict: { type: 'string', enum: VERDICTS },
          verdict_reason: { type: 'string' },
        },
      },
    },
  },
};

function parseArgs(argv) {
  const options = {
    batchLimit: integerFromEnv('TRIAGE_BATCH_LIMIT', DEFAULT_BATCH_LIMIT),
    maxItems: integerFromEnv('TRIAGE_MAX_ITEMS', null),
  };

  for (const arg of argv) {
    if (arg.startsWith('--limit=')) options.batchLimit = parsePositiveInt(arg.slice(8), 'limit');
    if (arg.startsWith('--max-items=')) options.maxItems = parsePositiveInt(arg.slice(12), 'max-items');
  }

  return options;
}

function integerFromEnv(name, fallback) {
  if (!process.env[name]) return fallback;
  return parsePositiveInt(process.env[name], name);
}

function parsePositiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

async function runTriageCycle(pool, argv = []) {
  const options = parseArgs(argv);
  getClaudeConfig();

  const runResult = await pool.query(
    `INSERT INTO nightly_runs (status, notes) VALUES ('running', 'collapsed triage/evidence/editor') RETURNING id`
  );
  const runId = runResult.rows[0].id;
  logger.info('triage', `Started triage run ${runId}`);

  const summary = {
    run_id: runId,
    batches: 0,
    items_triaged: 0,
    items_scored: 0,
    items_rejected: 0,
    items_published: 0,
  };

  const memoParts = [];

  try {
    while (options.maxItems === null || summary.items_triaged < options.maxItems) {
      const remaining = options.maxItems === null
        ? options.batchLimit
        : Math.min(options.batchLimit, options.maxItems - summary.items_triaged);
      const items = await claimBatch(pool, runId, remaining);
      if (items.length === 0) break;

      const triageResult = await callClaude(items);
      const saved = await saveBatch(pool, runId, items, triageResult);

      summary.batches++;
      summary.items_triaged += items.length;
      summary.items_scored += saved.scored;
      summary.items_rejected += saved.rejected;
      summary.items_published += saved.published;
      if (triageResult.private_memo.trim()) memoParts.push(triageResult.private_memo.trim());

      logger.info('triage', `Batch ${summary.batches}: ${items.length} items triaged`);
    }

    const privateMemo = buildPrivateMemo(summary, memoParts);
    await pool.query(
      `UPDATE nightly_runs
       SET status = 'completed',
           items_triaged = $1,
           items_scored = $2,
           items_rejected = $3,
           items_published = $4,
           private_memo = $5,
           triage_completed_at = now(),
           evidence_completed_at = now(),
           editor_completed_at = now(),
           completed_at = now()
       WHERE id = $6`,
      [
        summary.items_triaged,
        summary.items_scored,
        summary.items_rejected,
        summary.items_published,
        privateMemo,
        runId,
      ]
    );

    logger.info('triage', `Run ${runId} complete: ${summary.items_triaged} items triaged`);
    return summary;
  } catch (err) {
    await pool.query(
      `UPDATE raw_items
       SET processed_run_id = NULL
       WHERE processed_run_id = $1
         AND processed_at IS NULL`,
      [runId]
    );
    await pool.query(
      `UPDATE nightly_runs
       SET status = 'failed',
           error_log = $1,
           completed_at = now()
       WHERE id = $2`,
      [err.stack || err.message, runId]
    );
    throw err;
  }
}

async function claimBatch(pool, runId, limit) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `
        WITH claimable AS (
          SELECT ri.id
          FROM raw_items ri
          LEFT JOIN nightly_runs nr ON nr.id = ri.processed_run_id
          WHERE ri.processed_at IS NULL
            AND ri.fetched_at >= now() - interval '24 hours'
            AND (
              ri.processed_run_id IS NULL
              OR nr.status IN ('failed', 'cancelled')
              OR (nr.status = 'running' AND nr.started_at < now() - ($3::int * interval '1 hour'))
            )
          ORDER BY ri.fetched_at ASC, ri.id ASC
          LIMIT $1
          FOR UPDATE OF ri SKIP LOCKED
        )
        UPDATE raw_items ri
        SET processed_run_id = $2
        FROM claimable
        WHERE ri.id = claimable.id
        RETURNING ri.id,
                  ri.source_id,
                  ri.external_id,
                  ri.title,
                  ri.url,
                  ri.content,
                  ri.fetched_at,
                  ri.published_at
      `,
      [limit, runId, CLAIM_STALE_AFTER_HOURS]
    );
    await client.query('COMMIT');
    return result.rows;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function callClaude(items) {
  const { apiKey, model } = getClaudeConfig();

  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 12000,
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: buildUserPrompt(items) }],
      output_config: {
        effort: 'medium',
        format: {
          type: 'json_schema',
          schema: OUTPUT_SCHEMA,
        },
      },
    }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.error?.message || response.statusText;
    throw new Error(`Claude API ${response.status}: ${detail}`);
  }

  const text = body?.content
    ?.filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim();

  if (!text) throw new Error('Claude API returned no text content');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Claude API returned invalid JSON: ${err.message}`);
  }

  return normalizeTriageResult(parsed, items);
}

function getClaudeConfig() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required for triage');
  if (!model) throw new Error('ANTHROPIC_MODEL or CLAUDE_MODEL is required for triage');
  return { apiKey, model };
}

function buildSystemPrompt() {
  return [
    'You are the collapsed Triage + Evidence + Editor desk for Nightly Librarian.',
    'Audience: a serious solo developer deciding what is worth attention tomorrow morning.',
    'Filter aggressively. No hype, vendor cheerleading, affiliate framing, moral panic, culture-war bait, or generic trend filler.',
    'The core question is: what is worth mentioning, and why?',
    'Prefer evidence that changes a practical decision: API/platform change, pricing/cost shift, credible security risk, reproducible builder report, open source release with real leverage, or workflow change for agentic/dev tooling.',
    'Reject duplicate, thin, speculative, purely promotional, or low-relevance items.',
    'Return one result for every input raw_item_id. A rejected item still needs scores, verdict reject, and a concise verdict_reason.',
    'Write the private_memo as a compact markdown memo. Include only items that deserve attention; do not add an ignore pile.',
  ].join('\n');
}

function buildUserPrompt(items) {
  return JSON.stringify({
    instructions: 'Score these raw items. Use the schema exactly.',
    items: items.map((item) => ({
      raw_item_id: item.id,
      source_id: item.source_id,
      external_id: item.external_id,
      title: item.title || '',
      url: item.url || '',
      content: truncate(item.content || '', 4000),
      fetched_at: item.fetched_at,
      published_at: item.published_at,
    })),
  });
}

function normalizeTriageResult(parsed, items) {
  const itemIds = new Set(items.map((item) => item.id));
  const seen = new Set();
  const results = [];

  for (const raw of Array.isArray(parsed.results) ? parsed.results : []) {
    if (!itemIds.has(raw.raw_item_id) || seen.has(raw.raw_item_id)) continue;
    seen.add(raw.raw_item_id);
    results.push(normalizeCandidate(raw));
  }

  for (const item of items) {
    if (seen.has(item.id)) continue;
    results.push(defaultReject(item, 'Claude omitted this raw item from the structured result.'));
  }

  return {
    private_memo: typeof parsed.private_memo === 'string' ? parsed.private_memo : '',
    results,
  };
}

function normalizeCandidate(raw) {
  const candidate = {
    raw_item_id: raw.raw_item_id,
    title: stringOrFallback(raw.title, '(untitled)'),
    summary: stringOrFallback(raw.summary, ''),
    raw_claim: stringOrFallback(raw.raw_claim, ''),
    category: enumOrFallback(raw.category, CATEGORIES, 'builder_report'),
    evidence_level: enumOrFallback(raw.evidence_level, EVIDENCE_LEVELS, 'early_signal'),
    evidence_sources: Array.isArray(raw.evidence_sources) ? raw.evidence_sources.map(String).filter(Boolean) : [],
    uncertainty: stringOrFallback(raw.uncertainty, ''),
    worth_mentioning_reason: stringOrFallback(raw.worth_mentioning_reason, ''),
    verdict: enumOrFallback(raw.verdict, VERDICTS, 'reject'),
    verdict_reason: stringOrFallback(raw.verdict_reason, ''),
  };

  for (const field of SCORE_FIELDS) {
    candidate[field] = scoreOrNull(raw[field]);
  }

  return candidate;
}

function defaultReject(item, reason) {
  const candidate = normalizeCandidate({
    raw_item_id: item.id,
    title: item.title || '(untitled)',
    summary: '',
    raw_claim: item.title || '',
    category: 'builder_report',
    evidence_level: 'early_signal',
    evidence_sources: [item.url || item.source_id].filter(Boolean),
    uncertainty: reason,
    worth_mentioning_reason: 'Not worth mentioning.',
    verdict: 'reject',
    verdict_reason: reason,
  });
  candidate.score_worth_mentioning = 0;
  return candidate;
}

async function saveBatch(pool, runId, items, triageResult) {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const client = await pool.connect();
  let scored = 0;
  let rejected = 0;
  let published = 0;

  try {
    await client.query('BEGIN');
    for (const candidate of triageResult.results) {
      const item = itemsById.get(candidate.raw_item_id);
      if (!item) continue;

      await client.query(INSERT_CANDIDATE, [
        runId,
        item.id,
        item.source_id,
        candidate.title,
        candidate.summary,
        candidate.raw_claim,
        candidate.category,
        candidate.evidence_level,
        candidate.evidence_sources,
        candidate.uncertainty,
        candidate.worth_mentioning_reason,
        candidate.score_worth_mentioning,
        candidate.score_solo_dev_relevance,
        candidate.score_owner_work_relevance,
        candidate.score_future_work_relevance,
        candidate.score_decision_impact,
        candidate.score_evidence_strength,
        candidate.score_cost_time_leverage,
        candidate.score_risk_reduction,
        candidate.score_business_opportunity,
        candidate.score_hype_risk,
        candidate.score_novelty_penalty,
        candidate.verdict,
        candidate.verdict_reason,
      ]);

      scored++;
      if (candidate.verdict === 'reject') rejected++;
      if (candidate.verdict === 'publish_public' || candidate.verdict === 'publish_private') published++;
    }

    await client.query(
      `UPDATE raw_items
       SET processed = true,
           processed_at = now(),
           processed_run_id = $1
       WHERE id = ANY($2::uuid[])`,
      [runId, items.map((item) => item.id)]
    );

    await client.query('COMMIT');
    return { scored, rejected, published };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function buildPrivateMemo(summary, memoParts) {
  const header = [
    '# Nightly Librarian private memo',
    '',
    `Run: ${summary.run_id}`,
    `Items triaged: ${summary.items_triaged}`,
    `Candidates scored: ${summary.items_scored}`,
    `Rejected: ${summary.items_rejected}`,
    '',
  ].join('\n');

  const body = memoParts.length > 0
    ? memoParts.join('\n\n---\n\n')
    : 'No items cleared the worth-mentioning bar.';

  return `${header}${body}`;
}

function stringOrFallback(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function enumOrFallback(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function scoreOrNull(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(5, number));
}

function truncate(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}\n[truncated]` : value;
}

module.exports = { runTriageCycle };
