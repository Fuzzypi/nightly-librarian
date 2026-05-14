require('dotenv').config();

const { createPool } = require('./db');
const { runFetchCycle } = require('./runner');
const { runTriageCycle } = require('./triage');
const logger = require('./utils/logger');

async function main() {
  const pool = createPool();
  const command = process.argv[2] || 'fetch';

  try {
    if (command === 'fetch') {
      const summary = await runFetchCycle(pool);
      logger.info('main', 'Fetch cycle finished', JSON.stringify(summary));
      process.exitCode = summary.sources_failed > 0 && summary.sources_succeeded === 0 ? 1 : 0;
    } else if (command === 'triage') {
      const summary = await runTriageCycle(pool, process.argv.slice(3));
      logger.info('main', 'Triage cycle finished', JSON.stringify(summary));
    } else {
      throw new Error(`Unknown command: ${command}`);
    }
  } catch (err) {
    logger.error('main', 'Fatal error', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
