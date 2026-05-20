require('dotenv').config();

const { createPool } = require('../src/db');
const fetchers = require('../src/fetchers');

async function main() {
  const pool = createPool();
  const results = [];

  try {
    const { rows: sources } = await pool.query(
      'SELECT * FROM sources WHERE enabled = true ORDER BY source_type, id'
    );

    console.log(`\nTesting ${sources.length} sources...\n`);

    for (const source of sources) {
      const fetcher = fetchers[source.source_type];
      if (!fetcher) {
        results.push({ id: source.id, type: source.source_type, status: 'NO FETCHER', count: 0, ms: 0 });
        continue;
      }

      const start = Date.now();
      try {
        const items = await fetcher.fetchSource(source);
        const ms = Date.now() - start;
        results.push({ id: source.id, type: source.source_type, status: 'OK', count: items.length, ms });
      } catch (err) {
        const ms = Date.now() - start;
        results.push({ id: source.id, type: source.source_type, status: 'FAIL', count: 0, ms, error: err.message.slice(0, 60) });
      }
    }

    // Print summary table
    console.log('='.repeat(100));
    console.log(
      pad('SOURCE', 22),
      pad('TYPE', 16),
      pad('STATUS', 8),
      pad('ITEMS', 7),
      pad('TIME', 8),
      'ERROR'
    );
    console.log('-'.repeat(100));

    let ok = 0;
    let fail = 0;
    let totalItems = 0;

    for (const r of results) {
      console.log(
        pad(r.id, 22),
        pad(r.type, 16),
        pad(r.status, 8),
        pad(String(r.count), 7),
        pad(`${r.ms}ms`, 8),
        r.error || ''
      );
      if (r.status === 'OK') { ok++; totalItems += r.count; }
      else fail++;
    }

    console.log('-'.repeat(100));
    console.log(`\nSummary: ${ok} OK, ${fail} FAILED, ${totalItems} total items\n`);

    process.exitCode = fail > 0 && ok === 0 ? 1 : 0;
  } catch (err) {
    console.error(`Fatal: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

function pad(str, len) {
  return (str || '').padEnd(len);
}

main();
