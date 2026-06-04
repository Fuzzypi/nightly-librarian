require('dotenv').config();
const { createPool } = require('../src/db');

async function pruneOldItems() {
  const pool = createPool();
  try {
    const rawItems = await pool.query(
      `DELETE FROM raw_items
       WHERE fetched_at < now() - interval '90 days'`
    );

    const fetchLogs = await pool.query(
      `DELETE FROM fetch_log fl
       WHERE fl.started_at < now() - interval '90 days'
         AND NOT EXISTS (
           SELECT 1
           FROM raw_items ri
           WHERE ri.source_id = fl.source_id
             AND ri.fetched_at >= fl.started_at
             AND ri.fetched_at <= COALESCE(fl.completed_at, fl.started_at + interval '1 hour')
         )`
    );

    console.log(`Deleted ${rawItems.rowCount} raw_items and ${fetchLogs.rowCount} fetch_log rows`);
  } finally {
    await pool.end();
  }
}

pruneOldItems().catch((err) => {
  console.error(err);
  process.exit(1);
});
