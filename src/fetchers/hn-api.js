const logger = require('../utils/logger');

const HN_ITEM_URL = 'https://hacker-news.firebaseio.com/v0/item';
const CONCURRENCY = 5;

async function fetchItem(id) {
  const res = await fetch(`${HN_ITEM_URL}/${id}.json`);
  if (!res.ok) return null;
  return res.json();
}

async function fetchBatch(ids) {
  const results = [];
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    const items = await Promise.all(batch.map(fetchItem));
    results.push(...items);
  }
  return results;
}

async function fetchSource(source) {
  const topN = parseInt(process.env.HN_TOP_N, 10) || 30;
  const minScore = parseInt(process.env.HN_MIN_SCORE, 10) || 50;

  logger.info(source.id, `Fetching story IDs from ${source.url}`);

  const res = await fetch(source.url);
  if (!res.ok) throw new Error(`HN API ${res.status}: ${res.statusText}`);

  const storyIds = await res.json();
  const sliced = storyIds.slice(0, topN);

  logger.info(source.id, `Fetching top ${sliced.length} items (min score: ${minScore})`);

  const items = await fetchBatch(sliced);

  const filtered = items.filter((item) => {
    if (!item) return false;
    if ((item.score || 0) < minScore) return false;
    return true;
  });

  logger.info(source.id, `${filtered.length} items passed score filter (>= ${minScore})`);

  return filtered.map((item) => ({
    external_id: String(item.id),
    title: item.title || '(untitled)',
    url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
    content: item.text || '',
    published_at: item.time ? new Date(item.time * 1000).toISOString() : null,
    raw_data: item,
  }));
}

module.exports = { fetchSource };
