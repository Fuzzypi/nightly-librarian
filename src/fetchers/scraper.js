const cheerio = require('cheerio');
const crypto = require('crypto');
const logger = require('../utils/logger');

function hashId(str) {
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}

function extractWithConfig($, config, sourceUrl) {
  const items = [];
  const baseUrl = config.baseUrl || sourceUrl;

  $(config.itemSelector).each((_, el) => {
    const $el = $(el);
    const title = config.titleSelector
      ? $el.find(config.titleSelector).first().text().trim()
      : $el.text().trim();

    let link = '';
    if (config.linkSelector) {
      const linkEl = $el.find(config.linkSelector).first();
      link = linkEl.attr(config.linkAttr || 'href') || '';
    }
    if (link && !link.startsWith('http')) {
      link = new URL(link, baseUrl).href;
    }

    const date = config.dateSelector
      ? $el.find(config.dateSelector).first().text().trim()
      : '';

    const content = config.contentSelector
      ? $el.find(config.contentSelector).first().text().trim()
      : '';

    if (!title) return;

    items.push({
      external_id: link ? hashId(link) : hashId(title),
      title,
      url: link || sourceUrl,
      content,
      published_at: date ? tryParseDate(date) : null,
      raw_data: { title, link, date, content },
    });
  });

  return items;
}

function extractGeneric($, sourceUrl) {
  const items = [];

  $('article, .post, .changelog-entry, [class*="entry"], [class*="post"]').each((_, el) => {
    const $el = $(el);
    const headingEl = $el.find('h1, h2, h3, h4, a[href]').first();
    const title = headingEl.text().trim();
    if (!title) return;

    let link = '';
    const linkEl = $el.find('a[href]').first();
    if (linkEl.length) {
      link = linkEl.attr('href') || '';
      if (link && !link.startsWith('http')) {
        link = new URL(link, sourceUrl).href;
      }
    }

    const dateEl = $el.find('time, [datetime], [class*="date"]').first();
    const dateStr = dateEl.attr('datetime') || dateEl.text().trim();

    const content = $el.find('p').first().text().trim();

    items.push({
      external_id: link ? hashId(link) : hashId(title),
      title,
      url: link || sourceUrl,
      content,
      published_at: dateStr ? tryParseDate(dateStr) : null,
      raw_data: { title, link, date: dateStr, content },
    });
  });

  return items;
}

function tryParseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function fetchSource(source) {
  const ua = process.env.USER_AGENT || 'NightlyLibrarian/0.1';
  logger.info(source.id, `Scraping: ${source.url}`);

  const res = await fetch(source.url, {
    headers: { 'User-Agent': ua },
  });

  if (!res.ok) throw new Error(`Scrape ${res.status}: ${res.statusText}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  const config = source.extraction_config;
  const hasConfig = config && config.itemSelector;

  const items = hasConfig
    ? extractWithConfig($, config, source.url)
    : extractGeneric($, source.url);

  logger.info(source.id, `Extracted ${items.length} items ${hasConfig ? '(config)' : '(generic)'}`);
  return items;
}

module.exports = { fetchSource };
