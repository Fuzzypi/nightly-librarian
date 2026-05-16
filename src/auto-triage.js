require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const { createPool } = require('./db');
const { claimForAgent, completeAgentTriage, latestMemo } = require('./triage');
const logger = require('./utils/logger');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.TRIAGE_MODEL || 'claude-sonnet-4-20250514';
const MAX_TOKENS = 16000;
const MEMO_DIR = process.env.MEMO_DIR || '/var/www/nightly-librarian';

async function callClaude(systemPrompt, userPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in .env');

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Claude API ${response.status}: ${body}`);
  }

  const data = await response.json();
  const text = data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  return text;
}

function buildSystemPrompt(editorialRules, allowedValues) {
  return `You are the Triage Desk of The Nightly Librarian, an intelligence pipeline for a solo software developer.

Your job: read raw items collected from RSS feeds, GitHub releases, Hacker News, Reddit, and technical blogs. Score each item and decide whether it is worth mentioning.

EDITORIAL RULES:
${editorialRules.map((r) => `- ${r}`).join('\n')}

SCORING (0-5 scale for each):
- score_worth_mentioning: overall, is this worth the reader's attention?
- score_solo_dev_relevance: does this affect a solo developer's decisions?
- score_decision_impact: does this change what someone would build, buy, avoid, or investigate?
- score_evidence_strength: how solid is the evidence? (vendor claim = 1, reproducible = 4, production proven = 5)
- score_hype_risk: how likely is this just noise? (0 = no hype, 5 = pure hype)

CATEGORIES: ${allowedValues.categories.join(', ')}
EVIDENCE LEVELS: ${allowedValues.evidence_levels.join(', ')}
VERDICTS: publish_private (include in memo), monitor (note but don't highlight), reject (noise/irrelevant)

Respond with ONLY valid JSON matching this exact schema:
{
  "private_memo": "Compact markdown memo for the morning reader. 3-7 items max that actually deserve attention. Each item: what changed, why it matters, evidence level. No filler, no ignore pile.",
  "results": [
    {
      "raw_item_id": "uuid from input",
      "title": "concise title",
      "summary": "1-2 sentence summary",
      "category": "one of the allowed categories",
      "evidence_level": "one of the allowed evidence levels",
      "worth_mentioning_reason": "why this matters or why it was rejected",
      "score_worth_mentioning": 0,
      "score_solo_dev_relevance": 0,
      "score_decision_impact": 0,
      "score_evidence_strength": 0,
      "score_hype_risk": 0,
      "verdict": "publish_private or monitor or reject",
      "verdict_reason": "brief reason"
    }
  ]
}

Every raw_item_id from the input MUST appear in results. Most items should be rejected. Only 3-7 should be publish_private or monitor.`;
}

function buildUserPrompt(items) {
  const formatted = items.map((item, i) => {
    const parts = [
      `[${i + 1}] raw_item_id: ${item.raw_item_id}`,
      `    source: ${item.source_id}`,
      `    title: ${item.title}`,
      `    url: ${item.url}`,
    ];
    if (item.content && item.content.trim()) {
      const snippet = item.content.slice(0, 500);
      parts.push(`    content: ${snippet}`);
    }
    if (item.published_at) {
      parts.push(`    published: ${item.published_at}`);
    }
    return parts.join('\n');
  });

  return `Score and triage these ${items.length} raw items from today's fetch. Remember: most are noise. Only 3-7 should survive.\n\n${formatted.join('\n\n')}`;
}

async function writeMemoHtml(memo, runId) {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nightly Librarian — ${date}</title>
<style>
  body { max-width: 700px; margin: 40px auto; padding: 0 20px; font-family: Georgia, serif; line-height: 1.7; color: #1a1a1a; background: #fafaf8; }
  h1 { font-size: 1.4em; border-bottom: 1px solid #ccc; padding-bottom: 8px; }
  h2 { font-size: 1.1em; margin-top: 1.5em; color: #333; }
  ul { padding-left: 20px; }
  li { margin-bottom: 8px; }
  a { color: #2563eb; }
  .meta { font-size: 0.85em; color: #666; margin-bottom: 24px; }
  .empty { color: #888; font-style: italic; }
  code { background: #eee; padding: 2px 5px; border-radius: 3px; font-size: 0.9em; }
  pre { background: #f4f4f4; padding: 12px; border-radius: 4px; overflow-x: auto; }
</style>
</head>
<body>
<h1>The Nightly Librarian</h1>
<div class="meta">${date} &middot; Run ${runId ? runId.slice(0, 8) : 'n/a'}</div>
${memo ? memo.replace(/^#/gm, '##') : '<p class="empty">No memo generated for this run.</p>'}
</body>
</html>`;

  await fs.mkdir(MEMO_DIR, { recursive: true });
  await fs.writeFile(path.join(MEMO_DIR, 'index.html'), html);
  logger.info('deliver', `Memo written to ${MEMO_DIR}/index.html`);
}

async function run() {
  const pool = createPool();

  try {
    // Step 1: Claim items
    logger.info('auto-triage', 'Claiming unprocessed items...');
    const claim = await claimForAgent(pool);

    if (claim.claimed_count === 0) {
      logger.info('auto-triage', 'No items to triage');
      const latest = await latestMemo(pool);
      if (latest) await writeMemoHtml(latest.private_memo, latest.id);
      return;
    }

    logger.info('auto-triage', `Claimed ${claim.claimed_count} items for run ${claim.run_id}`);

    // Step 2: Call Claude API
    logger.info('auto-triage', `Sending ${claim.items.length} items to ${MODEL}...`);
    const systemPrompt = buildSystemPrompt(claim.editorial_rules, claim.allowed_values);
    const userPrompt = buildUserPrompt(claim.items);
    const rawResponse = await callClaude(systemPrompt, userPrompt);

    // Step 3: Parse response
    let parsed;
    try {
      const cleaned = rawResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      logger.error('auto-triage', 'Failed to parse Claude response', parseErr);
      logger.info('auto-triage', `Raw response (first 500 chars): ${rawResponse.slice(0, 500)}`);
      throw new Error('Claude returned invalid JSON');
    }

    // Step 4: Build completion payload
    const payload = {
      run_id: claim.run_id,
      private_memo: parsed.private_memo || 'Triage completed but no memo was generated.',
      results: parsed.results || [],
    };

    // Write temp file for completeAgentTriage
    const tmpFile = `/tmp/nightly-librarian-triage-${claim.run_id}.json`;
    await fs.writeFile(tmpFile, JSON.stringify(payload, null, 2));

    // Step 5: Complete triage
    logger.info('auto-triage', 'Completing triage...');
    await completeAgentTriage(pool, ['--input', tmpFile]);

    // Cleanup temp file
    await fs.unlink(tmpFile).catch(() => {});

    // Step 6: Write memo HTML
    await writeMemoHtml(payload.private_memo, claim.run_id);

    logger.info('auto-triage', `Done. ${claim.claimed_count} items triaged, memo written.`);
  } catch (err) {
    logger.error('auto-triage', 'Fatal error', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
