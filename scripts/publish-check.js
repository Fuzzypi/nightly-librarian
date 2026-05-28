#!/usr/bin/env node
"use strict";

/**
 * Local publish preflight for the generated static site.
 *
 * This command is intentionally local-only: it reads generated files and git
 * state, but never calls the network or posts anywhere.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const DATE_MD_RE = /^(\d{4}-\d{2}-\d{2})\.md$/;
const DATE_DIR_RE = /^\d{4}-\d{2}-\d{2}$/;
const MEANINGFUL_LEAD_MIN_CHARS = 80;
const MEANINGFUL_LEAD_MIN_WORDS = 12;

function parseArgs(argv) {
  const opts = {
    root: path.join(__dirname, ".."),
    strictGit: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") {
      opts.root = path.resolve(argv[i + 1] || "");
      i += 1;
    } else if (arg.startsWith("--root=")) {
      opts.root = path.resolve(arg.slice("--root=".length));
    } else if (arg === "--strict-git") {
      opts.strictGit = true;
    } else if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return opts;
}

function usage() {
  return `Usage: node scripts/publish-check.js [--root PATH] [--strict-git]

Checks local generated site artifacts only. No network calls are made.

Required:
  - site/index.html
  - site/feed.xml
  - site/sitemap.xml
  - latest dist/briefs/YYYY-MM-DD.md has site/briefs/YYYY-MM-DD/index.html
  - latest reports/YYYY-MM-DD.md has site/reports/YYYY-MM-DD/index.html
  - latest brief page has a meaningful lead summary

Optional:
  --strict-git   Treat dirty git state as a failure instead of a warning.
`;
}

function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function fileMtimeMs(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function listDatedMarkdown(dirPath) {
  if (!fs.existsSync(dirPath)) return [];

  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const match = entry.name.match(DATE_MD_RE);
      if (!match) return null;
      return {
        date: match[1],
        filePath: path.join(dirPath, entry.name),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function latestDatedMarkdown(dirPath) {
  const files = listDatedMarkdown(dirPath);
  return files.length ? files[files.length - 1] : null;
}

function extractLeadSummary(html) {
  const classMatch = html.match(/<p\b[^>]*class=["'][^"']*\blead-summary\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
  if (classMatch) return normalizeHtmlText(classMatch[1]);

  const metaMatch = html.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i)
    || html.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
  if (metaMatch) return normalizeHtmlText(metaMatch[1]);

  return "";
}

function normalizeHtmlText(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function isMeaningfulLead(text) {
  if (!text) return false;

  const normalized = text.trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  const placeholder = /^(todo|tbd|placeholder|summary pending|coming soon|no summary|n\/a)$/i;

  return normalized.length >= MEANINGFUL_LEAD_MIN_CHARS
    && words.length >= MEANINGFUL_LEAD_MIN_WORDS
    && !placeholder.test(normalized);
}

function gitStatus(root) {
  try {
    const output = execFileSync("git", ["status", "--short"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();

    return { available: true, clean: output.length === 0, output };
  } catch (error) {
    return {
      available: false,
      clean: false,
      output: error.stderr ? String(error.stderr).trim() : error.message,
    };
  }
}

function addResult(results, level, message, detail = "") {
  results.push({ level, message, detail });
}

function checkPublishReadiness({ root = path.join(__dirname, ".."), strictGit = false } = {}) {
  const resolvedRoot = path.resolve(root);
  const results = [];
  const fatal = [];

  function fail(message, detail = "") {
    fatal.push({ message, detail });
    addResult(results, "fail", message, detail);
  }

  function warn(message, detail = "") {
    addResult(results, "warn", message, detail);
  }

  function pass(message, detail = "") {
    addResult(results, "pass", message, detail);
  }

  const siteDir = path.join(resolvedRoot, "site");
  const distBriefsDir = path.join(resolvedRoot, "dist", "briefs");
  const reportsDir = path.join(resolvedRoot, "reports");

  for (const relativePath of ["site/index.html", "site/feed.xml", "site/sitemap.xml"]) {
    const filePath = path.join(resolvedRoot, relativePath);
    if (existsFile(filePath)) pass(`${relativePath} exists`);
    else fail(`${relativePath} is missing`);
  }

  const latestBrief = latestDatedMarkdown(distBriefsDir);
  if (!latestBrief) {
    fail("No generated brief markdown found", "Expected dist/briefs/YYYY-MM-DD.md");
  } else {
    const pagePath = path.join(siteDir, "briefs", latestBrief.date, "index.html");
    if (existsFile(pagePath)) {
      pass(`Latest brief has a site page`, `dist/briefs/${latestBrief.date}.md -> site/briefs/${latestBrief.date}/index.html`);
      if (fileMtimeMs(pagePath) + 1000 < fileMtimeMs(latestBrief.filePath)) {
        warn(`Latest brief page may be stale`, `site/briefs/${latestBrief.date}/index.html is older than dist/briefs/${latestBrief.date}.md`);
      }

      const html = fs.readFileSync(pagePath, "utf8");
      const lead = extractLeadSummary(html);
      if (isMeaningfulLead(lead)) {
        pass("Latest brief page has a meaningful lead summary", `${lead.length} characters`);
      } else {
        fail("Latest brief page is missing a meaningful lead summary", `Found: ${lead || "(none)"}`);
      }
    } else {
      fail(`Latest brief page is missing`, `Expected site/briefs/${latestBrief.date}/index.html`);
    }
  }

  const latestReport = latestDatedMarkdown(reportsDir);
  if (!latestReport) {
    warn("No report markdown found", "Expected reports/YYYY-MM-DD.md when reports are part of this publish");
  } else {
    const pagePath = path.join(siteDir, "reports", latestReport.date, "index.html");
    if (existsFile(pagePath)) {
      pass(`Latest report has a site page`, `reports/${latestReport.date}.md -> site/reports/${latestReport.date}/index.html`);
      if (fileMtimeMs(pagePath) + 1000 < fileMtimeMs(latestReport.filePath)) {
        warn(`Latest report page may be stale`, `site/reports/${latestReport.date}/index.html is older than reports/${latestReport.date}.md`);
      }
    } else {
      fail(`Latest report page is missing`, `Expected site/reports/${latestReport.date}/index.html`);
    }
  }

  const git = gitStatus(resolvedRoot);
  if (!git.available) {
    warn("Git status unavailable", git.output);
  } else if (git.clean) {
    pass("Git working tree is clean");
  } else if (strictGit) {
    fail("Git working tree has local changes", git.output);
  } else {
    warn("Git working tree has local changes", git.output);
  }

  addResult(
    results,
    "info",
    "Live verification is intentionally not part of publish:check",
    "Use the approved browse CLI separately after deployment when live checking is required."
  );

  return {
    ok: fatal.length === 0,
    fatal,
    results,
    latestBriefDate: latestBrief ? latestBrief.date : null,
    latestReportDate: latestReport ? latestReport.date : null,
  };
}

function formatResults(check) {
  const icon = {
    pass: "ok",
    warn: "warn",
    fail: "fail",
    info: "info",
  };

  const lines = ["== Publish preflight =="];
  for (const result of check.results) {
    lines.push(`${icon[result.level]} ${result.message}`);
    if (result.detail) lines.push(`   ${result.detail}`);
  }
  lines.push(check.ok ? "publish preflight ok" : "publish preflight failed");
  return lines.join("\n");
}

function main(argv = process.argv.slice(2)) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    return 2;
  }

  if (opts.help) {
    console.log(usage());
    return 0;
  }

  const check = checkPublishReadiness(opts);
  const output = formatResults(check);
  if (check.ok) console.log(output);
  else console.error(output);
  return check.ok ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  checkPublishReadiness,
  extractLeadSummary,
  formatResults,
  isMeaningfulLead,
  main,
  parseArgs,
};
