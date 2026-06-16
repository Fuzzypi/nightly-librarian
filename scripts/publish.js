#!/usr/bin/env node
"use strict";

/**
 * publish.js — the daily publish path for the static site.
 *
 * Goal: a daily run commits (and optionally pushes) the brief with no manual
 * git surgery, independent of any unrelated dirty state.
 *
 * It stages ONLY the canonical brief + report markdown for a given date:
 *
 *   dist/briefs/YYYY-MM-DD.md   (required)
 *   reports/YYYY-MM-DD.md       (included when present)
 *
 * It never runs `git add -A`, so regenerated (and now untracked) site/ output
 * or other working-tree noise can never sneak into the commit. The whitespace
 * preflight is scoped to the staged files (`git diff --cached --check`), so it
 * validates exactly what is about to be committed.
 *
 * Usage:
 *   node scripts/publish.js [--date YYYY-MM-DD] [--push] [--dry-run]
 *                           [--message "..."] [--no-build] [--no-check]
 *   npm run publish -- --date 2026-06-16 --push
 *
 * Defaults: date = today (local), builds the site and runs publish:check before
 * committing, commit message "brief: YYYY-MM-DD", does NOT push unless --push.
 *
 * No network calls except the optional --push. No credentials, no database.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { checkPublishReadiness, formatResults } = require("./publish-check.js");

const REPO_ROOT = path.join(__dirname, "..");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayLocalIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseArgs(argv) {
  const opts = {
    date: todayLocalIso(),
    push: false,
    dryRun: false,
    build: true,
    check: true,
    message: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--date") {
      opts.date = argv[i + 1] || "";
      i += 1;
    } else if (arg.startsWith("--date=")) {
      opts.date = arg.slice("--date=".length);
    } else if (arg === "--message" || arg === "-m") {
      opts.message = argv[i + 1] || "";
      i += 1;
    } else if (arg.startsWith("--message=")) {
      opts.message = arg.slice("--message=".length);
    } else if (arg === "--push") {
      opts.push = true;
    } else if (arg === "--dry-run") {
      opts.dryRun = true;
    } else if (arg === "--no-build") {
      opts.build = false;
    } else if (arg === "--no-check") {
      opts.check = false;
    } else if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!DATE_RE.test(opts.date)) {
    throw new Error(`Invalid --date "${opts.date}" (expected YYYY-MM-DD)`);
  }

  return opts;
}

function usage() {
  return `Usage: node scripts/publish.js [options]

Stages only the canonical brief + report markdown for a date, runs the local
publish preflight, and commits. Robust to unrelated dirty state.

Options:
  --date YYYY-MM-DD   Brief date to publish (default: today, local)
  --push              Push the current branch to origin after committing
  --dry-run           Build + check + show what would be staged; do not commit
  --message, -m TEXT  Commit message (default: "brief: YYYY-MM-DD")
  --no-build          Skip "npm run build:site" (assume site/ is fresh)
  --no-check          Skip the publish:check preflight
  --help, -h          Show this help
`;
}

function git(args, { capture = true } = {}) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
}

function currentBranch() {
  return git(["rev-parse", "--abbrev-ref", "HEAD"]).trim();
}

function sleepSync(ms) {
  // Synchronous sleep without spawning a process or busy-waiting.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function pushWithRetry(branch) {
  const backoffs = [0, 2000, 4000, 8000, 16000];
  for (let attempt = 0; attempt < backoffs.length; attempt += 1) {
    if (backoffs[attempt]) {
      console.log(`push failed — retry ${attempt}/${backoffs.length - 1} in ${backoffs[attempt] / 1000}s`);
      sleepSync(backoffs[attempt]);
    }
    try {
      git(["push", "-u", "origin", branch], { capture: false });
      return true;
    } catch (error) {
      if (attempt === backoffs.length - 1) {
        console.error(error.stderr ? String(error.stderr).trim() : error.message);
        return false;
      }
    }
  }
  return false;
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

  const briefPath = path.join(REPO_ROOT, "dist", "briefs", `${opts.date}.md`);
  const reportPath = path.join(REPO_ROOT, "reports", `${opts.date}.md`);
  const briefRel = path.relative(REPO_ROOT, briefPath);
  const reportRel = path.relative(REPO_ROOT, reportPath);

  if (!fs.existsSync(briefPath)) {
    console.error(`fail: brief not found: ${briefRel}`);
    console.error("Run the generate pipeline (social:generate) for this date first.");
    return 1;
  }

  const toStage = [briefRel];
  if (fs.existsSync(reportPath)) {
    toStage.push(reportRel);
  } else {
    console.warn(`warn: report not found: ${reportRel} (committing brief only)`);
  }

  // 1. Build the site so the preflight checks fresh output.
  if (opts.build) {
    console.log("== build:site ==");
    try {
      execFileSync("node", [path.join("scripts", "build-site.js")], {
        cwd: REPO_ROOT,
        stdio: "inherit",
      });
    } catch (error) {
      console.error("fail: build:site failed");
      return 1;
    }
  }

  // 2. Preflight: publish:check (non-strict git — we stage narrowly ourselves).
  if (opts.check) {
    const check = checkPublishReadiness({ root: REPO_ROOT, strictGit: false });
    console.log(formatResults(check));
    if (!check.ok) {
      console.error("fail: publish:check failed — not committing");
      return 1;
    }
  }

  const message = opts.message || `brief: ${opts.date}`;
  const branch = currentBranch();

  // 3. Dry-run: report intent from porcelain status, without touching the index.
  //    Scoped to the target paths, so it ignores unrelated working-tree state.
  if (opts.dryRun) {
    const status = git(["status", "--porcelain", "--", ...toStage]).trim();
    console.log("== dry-run ==");
    if (!status) {
      console.log(`nothing to commit — ${toStage.join(", ")} already match HEAD`);
      return 0;
    }
    console.log(`would commit: "${message}"`);
    console.log("files:");
    console.log(status);
    console.log(opts.push ? `would push branch: ${branch}` : "(push disabled)");
    return 0;
  }

  // 4. Stage ONLY the brief + report markdown (scoped pathspec; never add -A).
  //    Picks up brand-new (untracked) briefs while leaving unrelated state alone.
  git(["add", "--", ...toStage]);

  // 5. Nothing staged for these paths? Idempotent no-op on re-runs.
  let hasChanges = true;
  try {
    git(["diff", "--cached", "--quiet", "--", ...toStage]);
    hasChanges = false;
  } catch {
    hasChanges = true;
  }
  if (!hasChanges) {
    console.log(`nothing to commit — ${toStage.join(", ")} already match HEAD`);
    return 0;
  }

  // 6. Whitespace preflight scoped to exactly the staged target files.
  try {
    git(["diff", "--cached", "--check", "--", ...toStage]);
  } catch (error) {
    console.error("fail: target files have whitespace errors (git diff --cached --check):");
    console.error(error.stdout ? String(error.stdout).trim() : String(error.stderr || "").trim());
    return 1;
  }

  // 7. Commit ONLY these paths. The pathspec keeps any other staged changes
  //    (e.g. the one-time site/ untracking) out of this commit.
  git(["commit", "-m", message, "--", ...toStage], { capture: false });
  console.log(`committed: ${message}`);

  // 7. Optionally push.
  if (opts.push) {
    console.log(`== push origin ${branch} ==`);
    if (!pushWithRetry(branch)) {
      console.error("fail: push failed after retries");
      return 1;
    }
    console.log("pushed");
  } else {
    console.log("(not pushed — pass --push to deploy)");
  }

  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = { main, parseArgs, todayLocalIso };
