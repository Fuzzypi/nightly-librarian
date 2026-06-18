const fs = require('fs/promises');
const preTriage = require('./utils/pre-triage');

const DEFAULT_BATCH_LIMIT = 40;
const CLAIM_STALE_AFTER_HOURS = 4;

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

function parseArgs(argv) {
  const options = {
    date: null,
    format: 'report',
    limit: integerFromEnv('TRIAGE_BATCH_LIMIT', DEFAULT_BATCH_LIMIT),
    mode: 'primary',
    runId: null,
    input: '-',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--date') {
      options.date = nextOptionValue(argv, index, '--date');
      index += 1;
    } else if (arg.startsWith('--date=')) {
      options.date = arg.slice(7);
    } else if (arg === '--format') {
      options.format = nextOptionValue(argv, index, '--format');
      index += 1;
    } else if (arg.startsWith('--format=')) {
      options.format = arg.slice(9);
    } else if (arg === '--limit') {
      options.limit = parsePositiveInt(nextOptionValue(argv, index, '--limit'), 'limit');
      index += 1;
    } else if (arg.startsWith('--limit=')) {
      options.limit = parsePositiveInt(arg.slice(8), 'limit');
    } else if (arg === '--mode') {
      options.mode = nextOptionValue(argv, index, '--mode');
      index += 1;
    } else if (arg.startsWith('--mode=')) {
      options.mode = arg.slice(7);
    } else if (arg === '--run-id') {
      options.runId = nextOptionValue(argv, index, '--run-id');
      index += 1;
    } else if (arg.startsWith('--run-id=')) {
      options.runId = arg.slice(9);
    } else if (arg === '--input') {
      options.input = nextOptionValue(argv, index, '--input');
      index += 1;
    } else if (arg.startsWith('--input=')) {
      options.input = arg.slice(8);
    }
  }

  return options;
}

function nextOptionValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Expected value after ${flag}.`);
  }
  return value;
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

async function claimForAgent(pool, argv = []) {
  const options = parseArgs(argv);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const runResult = await client.query(
      `INSERT INTO nightly_runs (status, notes)
       VALUES ('running', 'agent-owned collapsed triage/evidence/editor')
       RETURNING id`
    );
    const runId = runResult.rows[0].id;

    const claimResult = await client.query(
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
      [options.limit, runId, CLAIM_STALE_AFTER_HOURS]
    );

    if (claimResult.rows.length === 0) {
      await client.query(
        `UPDATE nightly_runs
         SET status = 'completed',
             private_memo = 'No unprocessed raw items were available for the last 24 hours.',
             triage_completed_at = now(),
             evidence_completed_at = now(),
             editor_completed_at = now(),
             completed_at = now()
         WHERE id = $1`,
        [runId]
      );
    }

    await client.query('COMMIT');

    // Pre-triage: deduplicate near-identical titles, cap per-source volume,
    // annotate engagement signals from raw_data for Codex context.
    const { items: triageItems, stats: preTriageStats } = preTriage.runPreTriage(claimResult.rows);

    if (preTriageStats.duplicates_removed > 0 || preTriageStats.deferred_over_cap > 0) {
      logger.info('triage', `Pre-triage: ${claimResult.rows.length} claimed → ${triageItems.length} to Codex (${preTriageStats.duplicates_removed} dupes, ${preTriageStats.deferred_over_cap} capped)`);
    }

    // Write duplicate_of back to DB for the items we collapsed
    if (preTriageStats.duplicate_ids.length > 0) {
      for (const { id, duplicate_of } of preTriageStats.duplicate_ids) {
        await client.query(
          `UPDATE raw_items SET duplicate_of = $1 WHERE id = $2`,
          [duplicate_of, id]
        ).catch(() => {}); // non-fatal
      }
    }

    return {
      run_id: runId,
      claimed_count: claimResult.rows.length,
      pre_triage: preTriageStats,
      editorial_rules: editorialRules(),
      allowed_values: {
        categories: CATEGORIES,
        evidence_levels: EVIDENCE_LEVELS,
        verdicts: VERDICTS,
        score_fields: SCORE_FIELDS,
      },
      completion_contract: completionContract(runId, claimResult.rows),
      items: triageItems.map(formatRawItem),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function completeAgentTriage(pool, argv = []) {
  const options = parseArgs(argv);
  const payload = JSON.parse(await readInput(options.input));
  const runId = payload.run_id || options.runId;
  if (!runId) throw new Error('run_id is required in payload or --run-id');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const claimed = await client.query(
      `SELECT id, source_id, title, url, content
       FROM raw_items
       WHERE processed_run_id = $1
         AND processed_at IS NULL
       ORDER BY fetched_at ASC, id ASC
       FOR UPDATE`,
      [runId]
    );

    const claimedById = new Map(claimed.rows.map((item) => [item.id, item]));
    const rawResults = Array.isArray(payload.results) ? payload.results : [];
    const resultsById = new Map();

    for (const raw of rawResults) {
      if (!claimedById.has(raw.raw_item_id)) continue;
      if (resultsById.has(raw.raw_item_id)) continue;
      resultsById.set(raw.raw_item_id, normalizeCandidate(raw));
    }

    for (const item of claimed.rows) {
      if (!resultsById.has(item.id)) {
        resultsById.set(item.id, defaultReject(item, 'Scheduled agent omitted this claimed item from the completion payload.'));
      }
    }

    let scored = 0;
    let rejected = 0;
    let published = 0;

    for (const item of claimed.rows) {
      const candidate = resultsById.get(item.id);
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

    const privateMemo = stringOrFallback(payload.private_memo, buildPrivateMemo(runId, scored, rejected, [], claimed.rows));
    await client.query(
      `UPDATE raw_items
       SET processed = true,
           processed_at = now()
       WHERE processed_run_id = $1
         AND processed_at IS NULL`,
      [runId]
    );
    await client.query(
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
      [claimed.rows.length, scored, rejected, published, privateMemo, runId]
    );

    await client.query('COMMIT');

    return {
      run_id: runId,
      status: 'completed',
      items_triaged: claimed.rows.length,
      items_scored: scored,
      items_rejected: rejected,
      items_published: published,
      private_memo: privateMemo,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function failAgentTriage(pool, argv = []) {
  const options = parseArgs(argv);
  if (!options.runId) throw new Error('--run-id is required');

  await pool.query(
    `UPDATE raw_items
     SET processed_run_id = NULL
     WHERE processed_run_id = $1
       AND processed_at IS NULL`,
    [options.runId]
  );
  await pool.query(
    `UPDATE nightly_runs
     SET status = 'failed',
         error_log = 'Scheduled agent failed or abandoned the triage run.',
         completed_at = now()
     WHERE id = $1`,
    [options.runId]
  );

  return { run_id: options.runId, status: 'failed', claims_released: true };
}

async function reportAgentTriage(pool, argv = []) {
  const options = parseArgs(argv);
  if (!options.runId) throw new Error('--run-id is required');
  if (!['report', 'structured-json'].includes(options.format)) {
    throw new Error('--format must be report or structured-json');
  }

  const runResult = await pool.query(
    `SELECT id, status, started_at, completed_at, private_memo, items_triaged, items_scored, items_rejected, items_published
     FROM nightly_runs
     WHERE id = $1`,
    [options.runId]
  );
  const run = runResult.rows[0];
  if (!run) throw new Error(`Run not found: ${options.runId}`);

  const candidateResult = await pool.query(
    `SELECT c.raw_item_id, c.title, c.summary, c.verdict, c.verdict_reason,
            c.raw_claim, c.category, c.evidence_level, c.evidence_sources,
            c.uncertainty, c.worth_mentioning_reason,
            c.score_worth_mentioning, c.score_solo_dev_relevance,
            c.score_owner_work_relevance, c.score_future_work_relevance,
            c.score_decision_impact, c.score_evidence_strength,
            c.score_cost_time_leverage, c.score_risk_reduction,
            c.score_business_opportunity, c.score_hype_risk,
            c.score_novelty_penalty,
            ri.source_id, ri.url, ri.content, ri.fetched_at, ri.published_at
     FROM candidates c
     JOIN raw_items ri ON ri.id = c.raw_item_id
     WHERE c.run_id = $1
     ORDER BY ri.fetched_at ASC, ri.id ASC`,
    [options.runId]
  );

  const rows = candidateResult.rows;
  if (options.format === 'structured-json') {
    return buildStructuredExport(run, rows, options);
  }

  const worthAttention = rows
    .filter((row) => row.verdict === 'publish_private' || row.verdict === 'publish_public' || row.verdict === 'monitor')
    .sort((a, b) => (b.score_worth_mentioning - a.score_worth_mentioning) || (b.score_decision_impact - a.score_decision_impact))
    .slice(0, 12);

  const lines = [];
  lines.push('# Nightly Librarian — Newsletter draft');
  lines.push('');
  lines.push(`Run: ${run.id}`);
  if (run.started_at) lines.push(`Started: ${new Date(run.started_at).toISOString()}`);
  if (run.completed_at) lines.push(`Completed: ${new Date(run.completed_at).toISOString()}`);
  lines.push('');

  lines.push('## Worth attention');
  lines.push('');
  if (worthAttention.length === 0) {
    lines.push('- (No items cleared the bar.)');
  } else {
    for (const item of worthAttention) {
      const summary = (item.summary || '').trim() || textSnippetFromHtml(item.content || '', 280) || '(No summary available.)';
      const url = item.url ? `\n  ${item.url}` : '';
      lines.push(`- **${item.title || '(untitled)'}**${url}\n  ${summary}`);
    }
  }
  lines.push('');

  lines.push('## Full digest');
  lines.push('');
  for (const item of rows) {
    const tag = item.verdict === 'publish_private' || item.verdict === 'publish_public'
      ? 'P'
      : item.verdict === 'monitor'
        ? 'M'
        : 'R';
    const url = item.url ? ` — ${item.url}` : '';
    const summary = (item.summary || '').trim() || textSnippetFromHtml(item.content || '', 140) || (item.verdict_reason || '').trim();
    const suffix = summary ? ` — ${summary}` : '';
    const source = item.source_id ? `[${item.source_id}] ` : '';
    lines.push(`- [${tag}] ${source}${item.title || '(untitled)'}${url}${suffix}`);
  }

  const markdown = lines.join('\n').trim() + '\n';

  return {
    run_id: run.id,
    status: 'reported',
    items_triaged: run.items_triaged,
    items_scored: run.items_scored,
    items_rejected: run.items_rejected,
    items_published: run.items_published,
    markdown,
  };
}

function buildStructuredExport(run, rows, options = {}) {
  if (run.status !== 'completed') {
    throw new Error(`Cannot export structured digest for run ${run.id}: status is ${run.status || 'unknown'}.`);
  }

  if (!['primary', 'fallback'].includes(options.mode)) {
    throw new Error('--mode must be primary or fallback');
  }

  const date = options.date || dateFromRun(run);
  validateDateString(date);

  const items = rows.map(formatStructuredCandidate);

  return {
    schema: 'nightly-librarian.triage-candidate-export/v1',
    date,
    status: 'reported',
    run_status: 'completed',
    mode: options.mode,
    title: `Nightly Librarian - ${date}`,
    summary: buildStructuredSummary(run, items),
    completed_at: isoString(run.completed_at),
    run_id: String(run.id),
    items,
  };
}

function dateFromRun(run) {
  const timestamp = isoString(run.completed_at || run.started_at);
  if (!timestamp) {
    throw new Error('Cannot derive export date from run timestamps; pass --date=YYYY-MM-DD.');
  }
  return timestamp.slice(0, 10);
}

function validateDateString(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Expected --date YYYY-MM-DD.');
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid calendar date: ${date}`);
  }
}

function buildStructuredSummary(run, items) {
  const promoted = items.filter((item) => item.verdict === 'publish_public' || item.verdict === 'publish_private' || item.verdict === 'monitor');
  const scored = Number(run.items_scored) || items.length;
  const rejected = Number(run.items_rejected) || items.filter((item) => item.verdict === 'reject').length;
  return `Completed Nightly Librarian run with ${promoted.length} promoted item(s), ${scored} scored item(s), and ${rejected} rejected item(s).`;
}

function formatStructuredCandidate(row) {
  return {
    raw_item_id: String(row.raw_item_id || ''),
    title: row.title || '(untitled)',
    url: row.url || '',
    source_id: row.source_id || '',
    published_at: isoString(row.published_at || row.fetched_at),
    fetched_at: isoString(row.fetched_at),
    category: row.category || 'builder_report',
    verdict: row.verdict || 'reject',
    raw_claim: row.raw_claim || '',
    summary: row.summary || '',
    worth_mentioning_reason: row.worth_mentioning_reason || row.summary || row.verdict_reason || '',
    evidence_level: row.evidence_level || 'early_signal',
    evidence_sources: arrayOfStrings(row.evidence_sources),
    uncertainty: row.uncertainty || '',
    verdict_reason: row.verdict_reason || '',
    score_worth_mentioning: scoreOrZero(row.score_worth_mentioning),
    score_solo_dev_relevance: scoreOrZero(row.score_solo_dev_relevance),
    score_owner_work_relevance: scoreOrZero(row.score_owner_work_relevance),
    score_future_work_relevance: scoreOrZero(row.score_future_work_relevance),
    score_decision_impact: scoreOrZero(row.score_decision_impact),
    score_evidence_strength: scoreOrZero(row.score_evidence_strength),
    score_cost_time_leverage: scoreOrZero(row.score_cost_time_leverage),
    score_risk_reduction: scoreOrZero(row.score_risk_reduction),
    score_business_opportunity: scoreOrZero(row.score_business_opportunity),
    score_hype_risk: scoreOrZero(row.score_hype_risk),
    score_novelty_penalty: scoreOrZero(row.score_novelty_penalty),
  };
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function isoString(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

async function latestMemo(pool) {
  const result = await pool.query(
    `SELECT id, started_at, completed_at, private_memo
     FROM nightly_runs
     WHERE private_memo IS NOT NULL
     ORDER BY started_at DESC
     LIMIT 1`
  );
  return result.rows[0] || null;
}

function completionContract(runId, items) {
  return {
    run_id: runId,
    private_memo:
      [
        'Markdown memo for the morning reader.',
        '',
        'Required sections:',
        '1) Worth attention (curated): 5–12 items max.',
        '   - For each included item: 2–4 sentence plain-English summary of what happened, why it matters, and what to do (if anything).',
        '   - Prefer decision-changing items (security, pricing, API changes, workflow leverage).',
        '2) Full digest: one line per claimed item with verdict tag ([P]/[M]/[R]), link, and a <=140 char summary.',
        '   - If you did not open/read the link, say so implicitly by keeping the summary title-based and mark evidence_level accordingly.',
        'Also include fetch/source failures at the top if any were observed.',
        'No hype, no cheerleading, no padding.',
      ].join('\n'),
    results: items.map((item) => ({
      raw_item_id: item.id,
      title: item.title || '(untitled)',
      summary: extractSummarySeed(item),
      raw_claim: extractSummarySeed(item) || item.summary || item.title || '',
      category: 'builder_report',
      evidence_level: 'early_signal',
      evidence_sources: [item.url].filter(Boolean),
      uncertainty: '',
      worth_mentioning_reason: '',
      score_worth_mentioning: 0,
      score_solo_dev_relevance: 0,
      score_owner_work_relevance: 0,
      score_future_work_relevance: 0,
      score_decision_impact: 0,
      score_evidence_strength: 0,
      score_cost_time_leverage: 0,
      score_risk_reduction: 0,
      score_business_opportunity: 0,
      score_hype_risk: 0,
      score_novelty_penalty: 0,
      verdict: 'reject',
      verdict_reason: '',
    })),
  };
}

function editorialRules() {
  return [
    'Audience: a serious solo developer deciding what is worth attention tomorrow morning.',
    'Core question: what is worth mentioning, and why?',
    'Filter aggressively. No hype, vendor cheerleading, affiliate framing, moral panic, culture-war bait, generic trend filler, or "what to try next" padding.',
    'Prefer evidence that changes a practical decision: API/platform change, pricing/cost shift, credible security risk, reproducible builder report, open source release with real leverage, or workflow change for agentic/dev tooling.',
    'Reject duplicate, thin, speculative, purely promotional, or low-relevance items.',
    'Write in newsletter format. For curated items, summarize what happened + why it matters + what to do (if anything) in plain English.',
    'The private memo should be useful even on quiet days: include (1) a short curated "Worth attention" list and (2) a "Full digest" section that lists every claimed item with a verdict label, link, and a short summary (one line each). Include any fetch/source failures at the top.',
  ];
}

function formatRawItem(item) {
  const out = {
    raw_item_id: item.id,
    source_id: item.source_id,
    external_id: item.external_id,
    title: item.title || '',
    url: item.url || '',
    content: truncate(item.content || '', 4000),
    fetched_at: item.fetched_at,
    published_at: item.published_at,
  };
  // Attach engagement score when available (set by pre-triage annotateEngagement).
  // Codex uses this as a signal — higher score = more community traction.
  if (item.engagement_score !== null && item.engagement_score !== undefined) {
    out.engagement_score = item.engagement_score;
  }
  return out;
}

function extractSummarySeed(item) {
  const content = typeof item.content === 'string' ? item.content : '';
  const snippet = textSnippetFromHtml(content, 240);
  return snippet || '';
}

function textSnippetFromHtml(html, maxLength) {
  if (!html) return '';
  const stripped = html
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) return '';
  return stripped.length > maxLength ? `${stripped.slice(0, maxLength).trim()}…` : stripped;
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
    candidate[field] = scoreOrZero(raw[field]);
  }

  return candidate;
}

function defaultReject(item, reason) {
  return normalizeCandidate({
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
}

function buildPrivateMemo(runId, scored, rejected, memoParts, digestItems = []) {
  const body = memoParts.length > 0
    ? memoParts.join('\n\n---\n\n')
    : 'No items cleared the worth-mentioning bar.';

  const digestLines = Array.isArray(digestItems) && digestItems.length
    ? [
        '## Full digest',
        '',
        ...digestItems.map((item) => {
          const source = item.source_id ? `[${item.source_id}] ` : '';
          const title = item.title || '(untitled)';
          const url = item.url ? ` — ${item.url}` : '';
          const snippetText = item.content ? textSnippetFromHtml(item.content, 140) : '';
          const snippet = snippetText ? ` — ${snippetText}` : '';
          return `- ${source}${title}${url}${snippet}`;
        }),
      ]
    : [];

  return [
    '# Nightly Librarian private memo',
    '',
    `Run: ${runId}`,
    `Candidates scored: ${scored}`,
    `Rejected: ${rejected}`,
    '',
    body,
    '',
    ...digestLines,
  ].join('\n');
}

function stringOrFallback(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function enumOrFallback(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function scoreOrZero(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(5, number));
}

function truncate(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}\n[truncated]` : value;
}

async function readInput(input) {
  if (input === '-') {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
  }
  return fs.readFile(input, 'utf8');
}

module.exports = {
  claimForAgent,
  completeAgentTriage,
  failAgentTriage,
  completionContract,
  reportAgentTriage,
  latestMemo,
  __test: {
    editorialRules,
    buildStructuredExport,
    buildPrivateMemo,
    textSnippetFromHtml,
  },
};
