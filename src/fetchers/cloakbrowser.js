const path = require('path');

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return fallback;

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeSelectors(value) {
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
}

function resolveProxy(config, env) {
  const proxyEnvVar = normalizeString(config.proxyEnvVar);
  if (proxyEnvVar && normalizeString(env[proxyEnvVar])) {
    return env[proxyEnvVar].trim();
  }

  if (isObject(config.proxy)) {
    return config.proxy;
  }

  return normalizeString(config.proxy) || normalizeString(env.CLOAKBROWSER_PROXY);
}

function resolveUserDataDir(source, config, env) {
  const configuredPath = normalizeString(config.userDataDir);
  if (configuredPath) {
    return path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(process.cwd(), configuredPath);
  }

  if (!parseBoolean(config.persistent, false)) return null;

  const profileRoot = normalizeString(env.CLOAKBROWSER_PROFILE_ROOT);
  if (!profileRoot) {
    throw new Error(
      `CloakBrowser persistent mode for source ${source.id} requires browser.userDataDir or CLOAKBROWSER_PROFILE_ROOT`
    );
  }

  const root = path.isAbsolute(profileRoot)
    ? profileRoot
    : path.resolve(process.cwd(), profileRoot);

  return path.join(root, source.id || 'source');
}

function resolveBrowserConfig(source, env = process.env) {
  const extractionConfig = isObject(source.extraction_config) ? source.extraction_config : {};
  const inlineBrowser =
    extractionConfig.browser === true
      ? {}
      : isObject(extractionConfig.browser)
        ? extractionConfig.browser
        : {};

  const forcedByType = source.source_type === 'scrape_browser';
  const forcedByConfig = extractionConfig.renderWith === 'cloakbrowser' || extractionConfig.browser === true;
  const enabledByConfig = forcedByType || forcedByConfig || inlineBrowser.enabled === true;

  if (!enabledByConfig) {
    return { enabled: false };
  }

  const timeoutMs = parsePositiveInt(
    inlineBrowser.timeoutMs,
    parsePositiveInt(env.CLOAKBROWSER_TIMEOUT_MS, 30000)
  );

  return {
    enabled: true,
    headless: parseBoolean(inlineBrowser.headless, parseBoolean(env.CLOAKBROWSER_HEADLESS, true)),
    humanize: parseBoolean(inlineBrowser.humanize, parseBoolean(env.CLOAKBROWSER_HUMANIZE, false)),
    waitUntil: normalizeString(inlineBrowser.waitUntil) || 'domcontentloaded',
    waitForSelectors: normalizeSelectors(
      inlineBrowser.waitForSelectors ?? inlineBrowser.waitForSelector
    ),
    postLoadWaitMs: parsePositiveInt(inlineBrowser.postLoadWaitMs, 0),
    timeoutMs,
    args: Array.isArray(inlineBrowser.args) ? inlineBrowser.args.map(String) : [],
    proxy: resolveProxy(inlineBrowser, env),
    locale: normalizeString(inlineBrowser.locale) || normalizeString(env.CLOAKBROWSER_LOCALE),
    timezone: normalizeString(inlineBrowser.timezone) || normalizeString(env.CLOAKBROWSER_TIMEZONE),
    geoip: parseBoolean(inlineBrowser.geoip, false),
    userDataDir: resolveUserDataDir(source, inlineBrowser, env),
    contextOptions: isObject(inlineBrowser.contextOptions) ? { ...inlineBrowser.contextOptions } : {},
    launchOptions: isObject(inlineBrowser.launchOptions) ? { ...inlineBrowser.launchOptions } : {},
  };
}

async function loadCloakBrowser(importModule = (specifier) => import(specifier)) {
  let moduleExports;

  try {
    moduleExports = await importModule('cloakbrowser');
  } catch (err) {
    throw new Error(`Unable to load cloakbrowser: ${err.message}`);
  }

  const launch = moduleExports?.launch || moduleExports?.default?.launch;
  const launchPersistentContext =
    moduleExports?.launchPersistentContext || moduleExports?.default?.launchPersistentContext;

  if (typeof launch !== 'function') {
    throw new Error('cloakbrowser did not expose launch()');
  }

  return { launch, launchPersistentContext };
}

function buildLaunchOptions(config) {
  const launchOptions = { ...config.launchOptions };
  launchOptions.headless = config.headless;
  launchOptions.humanize = config.humanize;

  if (config.args.length > 0) launchOptions.args = config.args;
  if (config.proxy) launchOptions.proxy = config.proxy;
  if (config.locale) launchOptions.locale = config.locale;
  if (config.timezone) launchOptions.timezone = config.timezone;
  if (config.geoip) launchOptions.geoip = true;

  return launchOptions;
}

async function fetchRenderedHtml(source, config, deps = {}) {
  const loadModule = deps.loadModule || loadCloakBrowser;
  const sleep = deps.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const cloakbrowser = await loadModule();
  const launchOptions = buildLaunchOptions(config);

  let browser = null;
  let context = null;

  try {
    if (config.userDataDir) {
      if (typeof cloakbrowser.launchPersistentContext !== 'function') {
        throw new Error('cloakbrowser did not expose launchPersistentContext()');
      }

      context = await cloakbrowser.launchPersistentContext({
        userDataDir: config.userDataDir,
        ...launchOptions,
        contextOptions: config.contextOptions,
      });
    } else {
      browser = await cloakbrowser.launch(launchOptions);

      if (Object.keys(config.contextOptions).length > 0) {
        context = await browser.newContext(config.contextOptions);
      }
    }

    const existingPages =
      context && typeof context.pages === 'function'
        ? context.pages()
        : [];
    const page =
      context
        ? existingPages[0] || await context.newPage()
        : await browser.newPage();

    if (typeof page.setDefaultTimeout === 'function') {
      page.setDefaultTimeout(config.timeoutMs);
    }

    await page.goto(source.url, {
      waitUntil: config.waitUntil,
      timeout: config.timeoutMs,
    });

    for (const selector of config.waitForSelectors) {
      await page.waitForSelector(selector, { timeout: config.timeoutMs });
    }

    if (config.postLoadWaitMs > 0) {
      await sleep(config.postLoadWaitMs);
    }

    return await page.content();
  } finally {
    if (context && typeof context.close === 'function') {
      await context.close();
    }
    if (browser && typeof browser.close === 'function') {
      await browser.close();
    }
  }
}

module.exports = {
  fetchRenderedHtml,
  resolveBrowserConfig,
  __test: {
    buildLaunchOptions,
    loadCloakBrowser,
    parseBoolean,
    parsePositiveInt,
    resolveBrowserConfig,
    resolveProxy,
    resolveUserDataDir,
  },
};
