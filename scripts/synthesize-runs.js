#!/usr/bin/env node
"use strict";

/**
 * synthesize-runs.js
 *
 * Merges two (or more) triage completion JSONs into a single
 * triage-candidate-export that digest:import can consume directly.
 *
 * Usage:
 *   node scripts/synthesize-runs.js \
 *     --primary completion-AAAA.json \
 *     --secondary completion-BBBB.json \
 *     --date 2026-05-23 \
 *     [--out artifacts/synthesized/2026-05-23.json] \
 *     [--dry-run] [--force]
 *
 * --secondary is optional. If omitted the primary completion is
 * wrapped and output directly (useful for single-run days).
 *
 * Output format is "triage-candidate-export/v1" as expected by
 * digest:import (the normalizeCandidateExport path).
 *
 * No network access, database connection, credentials, or paid
 * integrations are used.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const SCRIPT_VERSION = "synthesize-runs/v1";

// Verdict precedence: higher index = more promoted.
const VERDICT_RANK = new Map([
  ["reject", 0],
  ["monitor", 1],
  ["publish_private", 2],
  ["publish_public", 3],
]);

const USAGE = `Usage:
  node scripts/synthesize-runs.js \\
    --primary completion-AAAA.json \\
    [--secondary completion-BBBB.json] \\
    --date YYYY-MM-DD \\
    [--out artifacts/synthesized/YYYY-MM-DD.json] \\
    [--dry-run] [--force]

Merges two triage completion JSONs into a single digest:import-compatible
triage-candidate-export. --secondary is optional for single-run days.

Side effects: writes one JSON file unless --dry-run is set.`;

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const parsed = {
    primary: null,
    secondary: null,
    date: null,
    out: null,
    dryRun: false,
    force: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--dry-run") {
      parsed.dryRun = true;
    } else if (arg === "--force") {
      parsed.force = true;
    } else if (arg === "--primary") {
      parsed.primary = nextArg(argv, i, "--primary");
      i += 1;
    } else if (arg.startsWith("--primary=")) {
      parsed.primary = arg.slice("--primary=".length);
    } else if (arg === "--secondary") {
      parsed.secondary = nextArg(argv, i, "--secondary");
      i += 1;
    } else if (arg.startsWith("--secondary=")) {
      parsed.secondary = arg.slice("--secondary=".length);
    } else if (arg === "--date") {
      parsed.date = nextArg(argv, i, "--date");
      i += 1;
    } else if (arg.startsWith("--date=")) {
      parsed.date = arg.slice("--date=".length);
    } else if (arg === "--out") {
      parsed.out = nextArg(argv, i, "--out");
      i += 1;
    } else if (arg.startsWith("--out=")) {
      parsed.out = arg.slice("--out=".length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function nextArg(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Expected value after ${flag}.`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateDate(date) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Expected --date YYYY-MM-DD.");
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid calendar date: ${date}`);
  }
}

function stringValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

// ---------------------------------------------------------------------------
// File I/O
// ---------------------------------------------------------------------------

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return {
    raw,
    parsed: JSON.parse(raw),
    sha256: crypto.createHash("sha256").update(raw).digest("hex"),
  };
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return value.map(stableStringify);
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((out, key) => {
        out[key] = stableStringify(value[key]);
        return out;
      }, {});
  }
  return value;
}

function jsonString(value) {
  return `${JSON.stringify(stableStringify(value), null, 2)}\n`;
}

function writeOutput(outPath, content, force) {
  if (fs.existsSync(outPath)) {
    const current = fs.readFileSync(outPath, "utf8");
    if (current === content) return "unchanged";
    if (!force) {
      throw new Error(
        `Output already exists and differs: ${outPath}. Use --force to replace it.`
      );
    }
    fs.writeFileSync(outPath, content);
    return "updated";
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content);
  return "created";
}

// ---------------------------------------------------------------------------
// Item merging
// ---------------------------------------------------------------------------

function verdictRank(verdict) {
  return VERDICT_RANK.get(stringValue(verdict)) ?? 0;
}

function scoreOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Pick the "better" of two items scored for the same raw_item_id.
 * "Better" = higher verdict rank, then higher score_worth_mentioning.
 */
function betterItem(a, b) {
  const rankA = verdictRank(a.verdict);
  const rankB = verdictRank(b.verdict);
  if (rankA !== rankB) return rankA >= rankB ? a : b;
  return scoreOrZero(a.score_worth_mentioning) >= scoreOrZero(b.score_worth_mentioning) ? a : b;
}

/**
 * Ensure each item satisfies digest:import's field requirements:
 *
 * 1. worth_mentioning_reason — required by normalizeCandidateItem as builder_takeaway.
 *    Falls back to summary → verdict_reason → title.
 *
 * 2. published_at — required as an ISO-8601 timestamp by validateDigest.
 *    Raw completion items have no DB timestamps; fall back to the synthesis date.
 */
function enrichItem(item, fallbackDate) {
  const enriched = { ...item };

  // Ensure builder_takeaway surrogate
  if (
    !stringValue(enriched.worth_mentioning_reason) &&
    !stringValue(enriched.builder_takeaway) &&
    !stringValue(enriched.builder_impact)
  ) {
    enriched.worth_mentioning_reason =
      stringValue(enriched.summary) ||
      stringValue(enriched.verdict_reason) ||
      stringValue(enriched.title) ||
      "(no summary available)";
  }

  // Ensure published_at timestamp
  if (
    !stringValue(enriched.published_at) &&
    !stringValue(enriched.discovered_at) &&
    !stringValue(enriched.fetched_at)
  ) {
    enriched.published_at = `${fallbackDate}T00:00:00.000Z`;
  }

  return enriched;
}

/**
 * Merge the results arrays from all completions.
 * Each item is keyed by raw_item_id; conflicts are resolved by betterItem().
 * Items without raw_item_id are included as-is (keyed by a fallback URL).
 * All items are enriched to satisfy digest:import's field requirements.
 */
function mergeItems(completions) {
  const byId = new Map();

  for (const completion of completions) {
    const results = Array.isArray(completion.results) ? completion.results : [];
    for (const item of results) {
      const key =
        stringValue(item.raw_item_id) ||
        (Array.isArray(item.evidence_sources) && stringValue(item.evidence_sources[0])) ||
        `__nokey__${Math.random()}`;

      if (byId.has(key)) {
        byId.set(key, betterItem(byId.get(key), item));
      } else {
        byId.set(key, item);
      }
    }
  }

  return Array.from(byId.values());
}

// ---------------------------------------------------------------------------
// Private memo merging
// ---------------------------------------------------------------------------

/**
 * Combine private_memo sections from multiple completions.
 * If memos are identical (or one is empty), returns the non-empty one.
 * If they differ, concatenates with a separator.
 */
function mergeMemos(completions, date) {
  const memos = completions
    .map((c) => stringValue(c.private_memo))
    .filter(Boolean);

  if (memos.length === 0) return `# Morning memo — ${date}\n\nNo memo content available.`;
  if (memos.length === 1) return memos[0];

  // Deduplicate identical memos
  const unique = [...new Set(memos)];
  if (unique.length === 1) return unique[0];

  // Multiple distinct memos — concatenate with a divider
  return unique
    .map((memo, index) => `<!-- Run ${index + 1} memo -->\n\n${memo}`)
    .join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// Summary generation
// ---------------------------------------------------------------------------

function buildSummary(items) {
  const promoted = items.filter(
    (item) =>
      item.verdict === "publish_public" ||
      item.verdict === "publish_private" ||
      item.verdict === "monitor"
  );
  const rejected = items.filter((item) => item.verdict === "reject");
  return (
    `Synthesized Nightly Librarian run with ${promoted.length} promoted item(s), ` +
    `${items.length} scored item(s), and ${rejected.length} rejected item(s).`
  );
}

// ---------------------------------------------------------------------------
// Core synthesis
// ---------------------------------------------------------------------------

function synthesize({ date, primaryPath, secondaryPath, baseDir = process.cwd() }) {
  validateDate(date);

  const primaryFile = readJson(path.resolve(baseDir, primaryPath));
  const primaryCompletion = primaryFile.parsed;

  const completions = [primaryCompletion];
  const inputFiles = [
    { path: primaryPath, sha256: primaryFile.sha256 },
  ];

  if (secondaryPath) {
    const secondaryFile = readJson(path.resolve(baseDir, secondaryPath));
    completions.push(secondaryFile.parsed);
    inputFiles.push({ path: secondaryPath, sha256: secondaryFile.sha256 });
  }

  const mergedItems = mergeItems(completions).map((item) => enrichItem(item, date));

  if (mergedItems.length === 0) {
    throw new Error("No items found in any completion file.");
  }

  const promotedCount = mergedItems.filter(
    (item) =>
      item.verdict === "publish_public" ||
      item.verdict === "publish_private" ||
      item.verdict === "monitor"
  ).length;

  if (promotedCount === 0) {
    throw new Error(
      "No promoted items (publish_public, publish_private, or monitor) found across all runs. " +
        "Cannot generate a brief with only rejected items."
    );
  }

  const runIds = completions
    .map((c) => stringValue(c.run_id))
    .filter(Boolean)
    .join("+");

  const output = {
    schema: "nightly-librarian.triage-candidate-export/v1",
    date,
    status: "completed",
    run_status: "completed",
    mode: "primary",
    title: `Nightly Librarian - ${date}`,
    summary: buildSummary(mergedItems),
    generated_at: new Date().toISOString(),
    run_id: runIds || "synthesized",
    synthesized_by: SCRIPT_VERSION,
    synthesized_from: inputFiles,
    private_memo: mergeMemos(completions, date),
    items: mergedItems,
  };

  return output;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function normalizeSlash(value) {
  return value.split(path.sep).join("/");
}

function relativePath(fromDir, targetPath) {
  const rel = path.relative(fromDir, targetPath);
  if (!rel || rel.startsWith("..")) {
    return normalizeSlash(path.resolve(targetPath));
  }
  return normalizeSlash(rel);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  if (!args.primary) throw new Error("--primary is required.");
  if (!args.date) throw new Error("--date YYYY-MM-DD is required.");

  const baseDir = process.cwd();
  const outPath = path.resolve(
    baseDir,
    args.out || path.join("artifacts", "synthesized", `${args.date}.json`)
  );

  const output = synthesize({
    date: args.date,
    primaryPath: args.primary,
    secondaryPath: args.secondary || null,
    baseDir,
  });

  const content = jsonString(output);
  const outputRelative = relativePath(baseDir, outPath);

  if (args.dryRun) {
    const result = {
      date: args.date,
      dry_run: true,
      input_count: args.secondary ? 2 : 1,
      item_count: output.items.length,
      promoted_count: output.items.filter(
        (item) =>
          item.verdict === "publish_public" ||
          item.verdict === "publish_private" ||
          item.verdict === "monitor"
      ).length,
      output: outputRelative,
      side_effects: {
        credentials: false,
        network: false,
        public_posting: false,
        writes_files: false,
      },
    };
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  const status = writeOutput(outPath, content, args.force);

  const result = {
    date: args.date,
    dry_run: false,
    input_count: args.secondary ? 2 : 1,
    item_count: output.items.length,
    promoted_count: output.items.filter(
      (item) =>
        item.verdict === "publish_public" ||
        item.verdict === "publish_private" ||
        item.verdict === "monitor"
    ).length,
    run_id: output.run_id,
    output: outputRelative,
    operation: {
      path: outputRelative,
      status,
    },
    side_effects: {
      credentials: false,
      network: false,
      public_posting: false,
      writes_files: status !== "unchanged",
    },
  };
  console.log(JSON.stringify(result, null, 2));
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error(USAGE);
    process.exitCode = 2;
  }
}

module.exports = { synthesize, mergeItems, betterItem, mergeMemos };
