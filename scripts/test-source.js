require('dotenv').config();

const { createPool } = require('../src/db');
const logger = require('../src/utils/logger');

const fetchers = {
  rss: require('../src/fetchers/rss'),
  github_release: require('../src/fetchers/github-release'),
  hn_api: require('../src/fetchers/hn-api'),
  reddit_json: require('../src/fetchers/reddit-json'),
  scrape: require('../src/fetchers/scraper'),
};

async function main() {
  const sourceId = process.argv[2];
  if (!sourceId) {
    console.error('Usage: node scripts/test-source.js <source_id>');
    process.exit(1);
  }

  const pool = createPool();

  try {
    const result = await pool.query('SELECT * FROM sources WHERE id = $1', [sourceId]);
    if (result.rows.length === 0) {
      console.error(`Source not found: ${sourceId}`);
      process.exit(1);
    }

    const source = result.rows[0];
    const fetcher = fetchers[source.source_type];
    if (!fetcher) {
      console.error(`No fetcher for type: ${source.source_type}`);
      process.exit(1);
    }

    console.log(`\nTesting: ${source.name} (${source.source_type})`);
    console.log(`URL: ${source.url}\n`);

    const start = Date.now();
    const items = await fetcher.fetchSource(source);
    const elapsed = Date.now() - start;

    console.log(`\nResults: ${items.length} items in ${elapsed}ms\n`);

    for (const item of items.slice(0, 5)) {
      console.log(`  - [${item.external_id?.slice(0, 12)}] ${item.title?.slice(0, 80)}`);
      if (item.published_at) console.log(`    published: ${item.published_at}`);
    }

    if (items.length > 5) {
      console.log(`  ... and ${items.length - 5} more`);
    }
  } catch (err) {
    console.error(`FAILED: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
