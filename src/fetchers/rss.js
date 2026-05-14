const RssParser = require('rss-parser');
const logger = require('../utils/logger');

const parser = new RssParser();
const UA = process.env.USER_AGENT || 'Mozilla/5.0 (compatible; NightlyLibrarian/0.1; +https://example.com)';

async function fetchSource(source) {
  logger.info(source.id, `Fetching RSS feed: ${source.url}`);

  const response = await fetch(source.url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Status code ${response.status}`);
  }

  const xml = await response.text();
  const feed = await parser.parseString(xml);

  if (!feed.items || feed.items.length === 0) {
    logger.warn(source.id, 'Feed returned zero items');
    return [];
  }

  logger.info(source.id, `Parsed ${feed.items.length} items from feed`);

  return feed.items.map((item) => ({
    external_id: item.guid || item.link || item.id,
    title: item.title || '(untitled)',
    url: item.link || '',
    content: item.content || item.contentSnippet || item.summary || '',
    published_at: item.isoDate || item.pubDate || null,
    raw_data: item,
  }));
}

module.exports = { fetchSource };
