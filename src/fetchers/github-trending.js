const logger = require('../utils/logger');

const GITHUB_API = 'https://api.github.com';

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function ghSearch(query, token, sourceId) {
  const ua = process.env.USER_AGENT || 'NightlyLibrarian/0.1';
  const params = new URLSearchParams(query);
  const url = `${GITHUB_API}/search/repositories?${params}`;

  const headers = {
    'User-Agent': ua,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { headers });

  if (res.status === 403) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    throw new Error(`GitHub API rate limited (remaining: ${remaining})`);
  }
  if (res.status === 422) {
    throw new Error(`GitHub Search invalid query: ${query.q}`);
  }
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`);

  const body = await res.json();
  logger.info(sourceId, `Search "${query.q}" → ${body.total_count} total, ${body.items?.length} returned`);
  return body;
}

async function fetchSource(source) {
  // GitHub tokens are always 40+ chars. Reject short/placeholder values so we
  // fall back to unauthenticated (60 search req/hr — plenty for 2 calls/run).
  const rawToken = process.env.GITHUB_TOKEN || '';
  const token = rawToken.length >= 40 ? rawToken : null;
  if (rawToken && !token) {
    logger.warn(source.id, 'GITHUB_TOKEN looks like a placeholder; fetching unauthenticated');
  }
  // source.url encodes the window: 'daily' | 'weekly' | 'monthly'
  const since = (source.url || 'weekly').trim().toLowerCase();
  const days = since === 'daily' ? 1 : since === 'monthly' ? 30 : 7;
  const perPage = parseInt(process.env.GITHUB_TRENDING_PER_PAGE, 10) || 25;
  const minStarsNew = parseInt(process.env.GITHUB_TRENDING_MIN_STARS_NEW, 10) || 50;
  const minStarsActive = parseInt(process.env.GITHUB_TRENDING_MIN_STARS_ACTIVE, 10) || 500;
  const dateThreshold = daysAgo(days);

  logger.info(source.id, `Fetching GitHub trending (since=${since}, after=${dateThreshold})`);

  // Query 1: brand-new repos this period with meaningful star counts
  const newReposResult = await ghSearch({
    q: `created:>${dateThreshold} stars:>=${minStarsNew}`,
    sort: 'stars',
    order: 'desc',
    per_page: perPage,
  }, token, source.id);

  // Query 2: established repos with recent pushes (projects having a moment)
  const activeReposResult = await ghSearch({
    q: `pushed:>${dateThreshold} stars:>=${minStarsActive} fork:false`,
    sort: 'stars',
    order: 'desc',
    per_page: Math.ceil(perPage / 2),
  }, token, source.id);

  // Merge, deduplicate by GitHub repo id
  const seen = new Set();
  const repos = [];
  for (const item of [
    ...(newReposResult.items || []),
    ...(activeReposResult.items || []),
  ]) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      repos.push(item);
    }
  }

  logger.info(source.id, `${repos.length} unique trending repos after merge`);

  return repos.map((r) => {
    const topicStr = r.topics?.length ? `Topics: ${r.topics.join(', ')}` : '';
    const content = [
      r.description || '',
      topicStr,
      `⭐ ${r.stargazers_count.toLocaleString()} stars | 🍴 ${r.forks_count.toLocaleString()} forks | ${r.language || 'N/A'}`,
      `Created: ${r.created_at?.slice(0, 10)}  Last push: ${r.pushed_at?.slice(0, 10)}`,
      r.license?.name ? `License: ${r.license.name}` : '',
    ].filter(Boolean).join('\n');

    return {
      external_id: String(r.id),
      title: `${r.full_name}: ${r.description || '(no description)'}`,
      url: r.html_url,
      content,
      published_at: r.created_at || null,
      raw_data: r,
    };
  });
}

module.exports = { fetchSource };
