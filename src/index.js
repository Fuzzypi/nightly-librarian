require('dotenv').config();

const { createPool } = require('./db');
const { runFetchCycle } = require('./runner');
const {
  claimForAgent,
  completeAgentTriage,
  failAgentTriage,
  reportAgentTriage,
  latestMemo,
} = require('./triage');
const logger = require('./utils/logger');

async function main() {
  const pool = createPool();
  const command = process.argv[2] || 'fetch';

  try {
    if (command === 'fetch') {
      const summary = await runFetchCycle(pool);
      logger.info('main', 'Fetch cycle finished', JSON.stringify(summary));
      process.exitCode = summary.sources_failed > 0 && summary.sources_succeeded === 0 ? 1 : 0;
    } else if (command === 'triage:claim') {
      const result = await claimForAgent(pool, process.argv.slice(3));
      console.log(JSON.stringify(result, null, 2));
    } else if (command === 'triage:complete') {
      const result = await completeAgentTriage(pool, process.argv.slice(3));
      console.log(JSON.stringify(result, null, 2));
    } else if (command === 'triage:fail') {
      const result = await failAgentTriage(pool, process.argv.slice(3));
      console.log(JSON.stringify(result, null, 2));
    } else if (command === 'triage:report') {
      const result = await reportAgentTriage(pool, process.argv.slice(3));
      console.log(JSON.stringify(result, null, 2));
    } else if (command === 'triage:latest') {
      const result = await latestMemo(pool);
      console.log(JSON.stringify(result, null, 2));
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
