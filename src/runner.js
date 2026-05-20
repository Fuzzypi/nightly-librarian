const logger = require('./utils/logger');
const fetchers = require('./fetchers');

const INSERT_RAW_ITEM = `
  INSERT INTO raw_items (source_id, external_id, title, url, content, raw_data, published_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  ON CONFLICT (source_id, external_id) DO NOTHING
`;

async function runFetchCycle(pool) {
  const runResult = await pool.query(
    `INSERT INTO nightly_runs (status) VALUES ('running') RETURNING id`
  );
  const runId = runResult.rows[0].id;
  logger.info('runner', `Started run ${runId}`);

  const sourcesResult = await pool.query(
    `SELECT * FROM sources WHERE enabled = true ORDER BY priority DESC, tier ASC`
  );
  const sources = sourcesResult.rows;
  logger.info('runner', `Found ${sources.length} enabled sources`);

  let sourcesSucceeded = 0;
  let sourcesFailed = 0;
  let totalNew = 0;
  let totalFound = 0;

  for (const source of sources) {
    const fetcher = fetchers[source.source_type];
    if (!fetcher) {
      logger.error(source.id, `No fetcher for type: ${source.source_type}`);
      continue;
    }

    await pool.query(
      `INSERT INTO fetch_log (run_id, source_id, status) VALUES ($1, $2, 'running')`,
      [runId, source.id]
    );

    try {
      const items = await fetcher.fetchSource(source);
      let itemsNew = 0;

      for (const item of items) {
        const result = await pool.query(INSERT_RAW_ITEM, [
          source.id,
          item.external_id,
          item.title,
          item.url,
          item.content,
          JSON.stringify(item.raw_data),
          item.published_at,
        ]);
        if (result.rowCount > 0) itemsNew++;
      }

      await pool.query(
        `UPDATE fetch_log
         SET status = 'success', items_found = $1, items_new = $2, completed_at = now()
         WHERE run_id = $3 AND source_id = $4`,
        [items.length, itemsNew, runId, source.id]
      );

      await pool.query(
        `UPDATE sources
         SET last_fetch_at = now(), last_success_at = now(), failure_count = 0, updated_at = now()
         WHERE id = $1`,
        [source.id]
      );

      sourcesSucceeded++;
      totalNew += itemsNew;
      totalFound += items.length;

      logger.info(source.id, `OK: ${items.length} found, ${itemsNew} new`);
    } catch (err) {
      await pool.query(
        `UPDATE fetch_log
         SET status = 'failed', error = $1, completed_at = now()
         WHERE run_id = $2 AND source_id = $3`,
        [err.message, runId, source.id]
      );

      await pool.query(
        `UPDATE sources
         SET last_fetch_at = now(), failure_count = failure_count + 1, updated_at = now()
         WHERE id = $1`,
        [source.id]
      );

      sourcesFailed++;
      logger.error(source.id, 'Fetch failed', err.message);
    }
  }

  await pool.query(
    `UPDATE nightly_runs
     SET status = 'completed',
         sources_attempted = $1,
         sources_succeeded = $2,
         sources_failed = $3,
         raw_items_fetched = $4,
         fetch_completed_at = now(),
         completed_at = now()
     WHERE id = $5`,
    [sources.length, sourcesSucceeded, sourcesFailed, totalNew, runId]
  );

  const summary = {
    run_id: runId,
    sources_attempted: sources.length,
    sources_succeeded: sourcesSucceeded,
    sources_failed: sourcesFailed,
    items_found: totalFound,
    items_new: totalNew,
  };

  logger.info('runner', `Run ${runId} complete: ${sourcesSucceeded}/${sources.length} sources OK, ${totalNew} new items`);
  return summary;
}

module.exports = { runFetchCycle };
