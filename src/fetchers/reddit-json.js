const logger = require('../utils/logger');

async function fetchSource(source) {
  const topN = parseInt(process.env.REDDIT_TOP_N, 10) || 25;
  const minScore = parseInt(process.env.REDDIT_MIN_SCORE, 10) || 10;
  const ua = process.env.USER_AGENT || 'NightlyLibrarian/0.1 (solo-dev intelligence pipeline)';

  const url = `${source.url}?limit=${topN}&raw_json=1`;
  logger.info(source.id, `Fetching Reddit listing: ${url}`);

  let res = await fetch(url, {
    headers: { 'User-Agent': ua },
  });

  if (res.status === 429) {
    logger.warn(source.id, 'Rate limited by Reddit, retrying in 2s');
    await new Promise((r) => setTimeout(r, 2000));
    res = await fetch(url, { headers: { 'User-Agent': ua } });
  }

  if (res.status === 403) {
    logger.error(source.id, 'Reddit returned 403 Forbidden');
    return [];
  }

  if (!res.ok) throw new Error(`Reddit ${res.status}: ${res.statusText}`);

  const body = await res.json();
  const children = body?.data?.children;

  if (!Array.isArray(children) || children.length === 0) {
    logger.warn(source.id, 'No posts returned');
    return [];
  }

  const filtered = children.filter(
    (c) => c.data && (c.data.score || 0) >= minScore
  );

  logger.info(source.id, `${filtered.length}/${children.length} posts passed score filter (>= ${minScore})`);

  return filtered.map((c) => {
    const d = c.data;
    return {
      external_id: d.name,
      title: d.title || '(untitled)',
      url: d.url || `https://www.reddit.com${d.permalink}`,
      content: d.selftext || '',
      published_at: d.created_utc
        ? new Date(d.created_utc * 1000).toISOString()
        : null,
      raw_data: d,
    };
  });
}

module.exports = { fetchSource };
