const assert = require('node:assert/strict');
const path = require('path');
const test = require('node:test');

const cloakbrowser = require('../src/fetchers/cloakbrowser');
const scraper = require('../src/fetchers/scraper');

test('resolveBrowserConfig enables scrape_browser sources with env-backed defaults', () => {
  const env = {
    CLOAKBROWSER_HEADLESS: 'false',
    CLOAKBROWSER_HUMANIZE: 'true',
    CLOAKBROWSER_TIMEOUT_MS: '45000',
    CLOAKBROWSER_PROXY: 'http://global-proxy:8080',
  };

  const config = cloakbrowser.resolveBrowserConfig({
    id: 'openai-changelog',
    source_type: 'scrape_browser',
    extraction_config: {
      browser: {
        waitForSelector: 'article',
        contextOptions: { userAgent: 'Nightly Librarian Test' },
      },
    },
  }, env);

  assert.equal(config.enabled, true);
  assert.equal(config.headless, false);
  assert.equal(config.humanize, true);
  assert.equal(config.timeoutMs, 45000);
  assert.deepEqual(config.waitForSelectors, ['article']);
  assert.equal(config.proxy, 'http://global-proxy:8080');
  assert.deepEqual(config.contextOptions, { userAgent: 'Nightly Librarian Test' });
});

test('resolveBrowserConfig derives a persistent profile path from CLOAKBROWSER_PROFILE_ROOT', () => {
  const env = {
    CLOAKBROWSER_PROFILE_ROOT: 'tmp/cloak-profiles',
  };

  const config = cloakbrowser.resolveBrowserConfig({
    id: 'meta-ai-blog',
    source_type: 'scrape',
    extraction_config: {
      browser: {
        enabled: true,
        persistent: true,
      },
    },
  }, env);

  assert.equal(
    config.userDataDir,
    path.resolve(process.cwd(), 'tmp/cloak-profiles', 'meta-ai-blog')
  );
});

test('fetchRenderedHtml launches CloakBrowser with context and wait options', async () => {
  const calls = [];
  const page = {
    setDefaultTimeout(ms) {
      calls.push(['setDefaultTimeout', ms]);
    },
    async goto(url, options) {
      calls.push(['goto', url, options]);
    },
    async waitForSelector(selector, options) {
      calls.push(['waitForSelector', selector, options]);
    },
    async content() {
      calls.push(['content']);
      return '<article><h2>Hello</h2></article>';
    },
  };
  const context = {
    pages() {
      calls.push(['pages']);
      return [];
    },
    async newPage() {
      calls.push(['newPage']);
      return page;
    },
    async close() {
      calls.push(['context.close']);
    },
  };
  const browser = {
    async newContext(options) {
      calls.push(['newContext', options]);
      return context;
    },
    async close() {
      calls.push(['browser.close']);
    },
  };

  const html = await cloakbrowser.fetchRenderedHtml(
    { id: 'source-1', url: 'https://example.com/posts' },
    {
      headless: true,
      humanize: false,
      waitUntil: 'networkidle',
      waitForSelectors: ['article', '.ready'],
      postLoadWaitMs: 25,
      timeoutMs: 1234,
      args: ['--fingerprint=123'],
      proxy: 'http://proxy:8080',
      locale: 'en-US',
      timezone: 'America/New_York',
      geoip: true,
      userDataDir: null,
      contextOptions: { userAgent: 'Nightly Librarian Test' },
      launchOptions: { channel: 'chrome' },
    },
    {
      loadModule: async () => ({
        async launch(options) {
          calls.push(['launch', options]);
          return browser;
        },
      }),
      sleep: async (ms) => {
        calls.push(['sleep', ms]);
      },
    }
  );

  assert.equal(html, '<article><h2>Hello</h2></article>');
  assert.deepEqual(calls[0], ['launch', {
    channel: 'chrome',
    headless: true,
    humanize: false,
    args: ['--fingerprint=123'],
    proxy: 'http://proxy:8080',
    locale: 'en-US',
    timezone: 'America/New_York',
    geoip: true,
  }]);
  assert.deepEqual(calls[1], ['newContext', { userAgent: 'Nightly Librarian Test' }]);
  assert.ok(calls.some((call) => call[0] === 'setDefaultTimeout' && call[1] === 1234));
  assert.ok(calls.some((call) => (
    call[0] === 'goto' &&
    call[1] === 'https://example.com/posts' &&
    call[2]?.waitUntil === 'networkidle' &&
    call[2]?.timeout === 1234
  )));
  assert.deepEqual(calls[calls.length - 2], ['context.close']);
  assert.deepEqual(calls[calls.length - 1], ['browser.close']);
});

test('fetchRenderedHtml forwards contextOptions when using a persistent profile', async () => {
  const calls = [];
  const page = {
    async goto() {},
    async content() {
      return '<html></html>';
    },
  };
  const context = {
    pages() {
      return [page];
    },
    async close() {
      calls.push(['context.close']);
    },
  };

  await cloakbrowser.fetchRenderedHtml(
    { id: 'source-2', url: 'https://example.com/persistent' },
    {
      headless: false,
      humanize: true,
      waitUntil: 'domcontentloaded',
      waitForSelectors: [],
      postLoadWaitMs: 0,
      timeoutMs: 5000,
      args: [],
      proxy: null,
      locale: 'en-US',
      timezone: 'America/New_York',
      geoip: false,
      userDataDir: '/tmp/nightly-librarian-profile',
      contextOptions: { userAgent: 'Persistent Agent' },
      launchOptions: {},
    },
    {
      loadModule: async () => ({
        async launchPersistentContext(options) {
          calls.push(['launchPersistentContext', options]);
          return context;
        },
      }),
    }
  );

  assert.deepEqual(calls[0], ['launchPersistentContext', {
    userDataDir: '/tmp/nightly-librarian-profile',
    headless: false,
    humanize: true,
    locale: 'en-US',
    timezone: 'America/New_York',
    contextOptions: { userAgent: 'Persistent Agent' },
  }]);
  assert.deepEqual(calls[calls.length - 1], ['context.close']);
});

test('scraper fetchSource uses browser-rendered html when browser mode is enabled', async () => {
  const source = {
    id: 'openai-changelog',
    source_type: 'scrape',
    url: 'https://example.com/changelog',
    extraction_config: {
      itemSelector: 'article',
      titleSelector: 'h2',
      linkSelector: 'a',
      contentSelector: 'p',
      dateSelector: 'time',
      browser: {
        enabled: true,
        waitForSelector: 'article',
      },
    },
  };

  const items = await scraper.fetchSource(source, {
    fetchRenderedHtml: async () => `
      <main>
        <article>
          <h2>Launch Week</h2>
          <a href="/posts/launch-week">Read</a>
          <time>2026-05-19</time>
          <p>New browser-backed scraping path.</p>
        </article>
      </main>
    `,
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Launch Week');
  assert.equal(items[0].url, 'https://example.com/posts/launch-week');
  assert.equal(items[0].content, 'New browser-backed scraping path.');
  assert.equal(items[0].published_at, '2026-05-19T00:00:00.000Z');
});

test('scraper fetchSource keeps the plain HTTP path for non-browser sources', async () => {
  const source = {
    id: 'plain-scrape',
    source_type: 'scrape',
    url: 'https://example.com/blog',
    extraction_config: {
      itemSelector: 'article',
      titleSelector: 'h2',
      linkSelector: 'a',
    },
  };

  const calls = [];
  const items = await scraper.fetchSource(source, {
    fetchImpl: async (url, options) => {
      calls.push([url, options]);
      return {
        ok: true,
        async text() {
          return `
            <article>
              <h2>HTTP Path</h2>
              <a href="/posts/http-path">Read</a>
            </article>
          `;
        },
      };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://example.com/blog');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'HTTP Path');
  assert.equal(items[0].url, 'https://example.com/posts/http-path');
});
