const logger = require('../utils/logger');

const GITHUB_API = 'https://api.github.com';

async function fetchSource(source) {
  const repo = source.url;
  const apiUrl = `${GITHUB_API}/repos/${repo}/releases?per_page=10`;
  const token = process.env.GITHUB_TOKEN;

  logger.info(source.id, `Fetching GitHub releases: ${repo}`);

  const res = await fetch(apiUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': process.env.USER_AGENT || 'NightlyLibrarian/0.1',
      'Accept': 'application/vnd.github+json',
    },
  });

  if (res.status === 403) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    logger.error(source.id, `Rate limited (remaining: ${remaining})`);
    throw new Error(`GitHub API rate limited for ${repo}`);
  }

  if (res.status === 404) {
    logger.warn(source.id, `Repository not found: ${repo}`);
    return [];
  }

  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
  }

  const releases = await res.json();

  if (!Array.isArray(releases) || releases.length === 0) {
    logger.warn(source.id, 'No releases found');
    return [];
  }

  logger.info(source.id, `Found ${releases.length} releases`);

  return releases.map((r) => ({
    external_id: String(r.id),
    title: r.name || r.tag_name || '(unnamed release)',
    url: r.html_url || '',
    content: r.body || '',
    published_at: r.published_at || r.created_at || null,
    raw_data: r,
  }));
}

module.exports = { fetchSource };
