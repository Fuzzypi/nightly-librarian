#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { validateDigest } = require("./social-generate.js");

const IMPORTER_VERSION = "digest-import/v1";
const DEFAULT_MODE_VALUES = new Set(["primary", "fallback"]);
const PROMOTED_VERDICTS = new Set(["publish_public", "publish_private", "monitor"]);
const IMPORTANCE_VALUES = new Set(["lead", "supporting", "archive", "archive-only"]);

const CATEGORY_MAP = new Map([
  ["voice_agents", "Voice AI / Realtime Agents"],
  ["voice_ai", "Voice AI / Realtime Agents"],
  ["realtime_agents", "Voice AI / Realtime Agents"],
  ["agent_workflow", "AI Operations / Agent Control"],
  ["ai_operations", "AI Operations / Agent Control"],
  ["security_risk", "AI Operations / Agent Control"],
  ["data_scraping", "Data Infrastructure / Verification / Scraping"],
  ["infrastructure", "Data Infrastructure / Verification / Scraping"],
  ["verification", "Data Infrastructure / Verification / Scraping"],
  ["automation", "Small Business Automation"],
  ["distribution", "Small Business Automation"],
  ["pricing_cost", "Small Business Automation"],
  ["solo_business", "Small Business Automation"],
  ["model_change", "Model + API Changes"],
  ["api_platform_change", "Model + API Changes"],
  ["open_source", "Tools Worth Testing"],
  ["builder_report", "Tools Worth Testing"],
  ["tool_release", "Tools Worth Testing"],
]);

const USAGE = `Usage:
  npm run digest:import -- --date YYYY-MM-DD --source path/to/upstream.json [--out artifacts/digests/YYYY-MM-DD.json] [--dry-run] [--force]

Normalizes an explicit local upstream digest artifact into the social:generate input contract.

No network access, credentials, public posting, database connection, or paid integrations are used.`;

function parseArgs(argv) {
  const parsed = {
    date: null,
    source: null,
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
    } else if (arg === "--date") {
      parsed.date = nextArg(argv, i, "--date");
      i += 1;
    } else if (arg.startsWith("--date=")) {
      parsed.date = arg.slice("--date=".length);
    } else if (arg === "--source") {
      parsed.source = nextArg(argv, i, "--source");
      i += 1;
    } else if (arg.startsWith("--source=")) {
      parsed.source = arg.slice("--source=".length);
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

function validateDate(date) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Expected --date YYYY-MM-DD.");
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid calendar date: ${date}`);
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return value.map(stableStringify);
  }
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = stableStringify(value[key]);
      return out;
    }, {});
  }
  return value;
}

function jsonString(value) {
  return `${JSON.stringify(stableStringify(value), null, 2)}\n`;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return {
    raw,
    parsed: JSON.parse(raw),
    sha256: crypto.createHash("sha256").update(raw).digest("hex"),
  };
}

function normalizeSlash(value) {
  return value.split(path.sep).join("/");
}

function relativePath(fromDir, targetPath) {
  const relative = path.relative(fromDir, targetPath);
  if (!relative || relative.startsWith("..")) {
    return normalizeSlash(path.resolve(targetPath));
  }
  return normalizeSlash(relative);
}

function assertObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object.`);
  }
}

function stringValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function requiredString(value, field) {
  const text = stringValue(value);
  if (!text) {
    throw new Error(`Missing required string field: ${field}`);
  }
  return text;
}

function optionalArray(value) {
  return Array.isArray(value) ? value.map((item) => stringValue(item)).filter(Boolean) : [];
}

function firstHttpUrl(values) {
  for (const value of values.flat()) {
    const text = stringValue(value);
    if (!text) {
      continue;
    }
    try {
      const parsed = new URL(text);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return text;
      }
    } catch {
      // Keep scanning; invalid source references are reported when no URL remains.
    }
  }
  return "";
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function timestampValue(...values) {
  for (const value of values) {
    const text = stringValue(value);
    if (text) {
      return text;
    }
  }
  return "";
}

function normalizeCategory(category) {
  const text = requiredString(category, "category");
  return CATEGORY_MAP.get(text) || text;
}

function normalizeImportance(value) {
  const text = stringValue(value);
  if (!text) {
    return "";
  }
  if (!IMPORTANCE_VALUES.has(text)) {
    throw new Error(`Invalid importance: ${text}`);
  }
  return text === "archive" ? "archive-only" : text;
}

function normalizeLabels(item) {
  const labels = new Set(optionalArray(item.labels));
  const evidenceLevel = stringValue(item.evidence_level);
  const verdict = stringValue(item.verdict);
  if (evidenceLevel) {
    labels.add(evidenceLevel);
  }
  if (verdict) {
    labels.add(verdict);
  }
  return Array.from(labels);
}

function resolveMode(source) {
  const mode = stringValue(source.mode);
  if (DEFAULT_MODE_VALUES.has(mode)) {
    return mode;
  }
  if (source.fallback === true) {
    return "fallback";
  }
  if (source.fallback === false) {
    return "primary";
  }
  throw new Error("Source artifact must include mode: primary|fallback or fallback: boolean.");
}

function resolveStatus(source) {
  const status = requiredString(source.status, "status");
  if (status === "completed") {
    return status;
  }
  if (status === "reported" && stringValue(source.run_status) === "completed") {
    return status;
  }
  throw new Error(`Source artifact status must be completed; received ${status}.`);
}

function resolveDate(source, expectedDate) {
  const date = stringValue(source.date) || stringValue(source.run_date) || expectedDate;
  validateDate(date);
  if (date !== expectedDate) {
    throw new Error(`Source artifact date ${date} does not match requested date ${expectedDate}.`);
  }
  return date;
}

function isPhaseOneDigest(source) {
  return Array.isArray(source.items) && source.items.some((item) => (
    item && Array.isArray(item.source_facts) && stringValue(item.builder_takeaway)
  ));
}

function normalizePhaseOneDigest(source, expectedDate, importMeta) {
  const date = resolveDate(source, expectedDate);
  resolveStatus(source);
  const normalized = {
    date,
    generated_at: timestampValue(source.generated_at, source.completed_at) || `${date}T00:00:00.000Z`,
    imported_from: importMeta,
    items: source.items.map((item) => ({
      builder_takeaway: requiredString(item.builder_takeaway, "items[].builder_takeaway"),
      category: normalizeCategory(item.category),
      id: requiredString(item.id, "items[].id"),
      importance: normalizeImportance(item.importance),
      labels: optionalArray(item.labels),
      product_relevance: optionalArray(item.product_relevance),
      published_at: timestampValue(item.published_at, item.fetched_at, item.discovered_at),
      source: requiredString(item.source, "items[].source"),
      source_facts: optionalArray(item.source_facts),
      title: requiredString(item.title, "items[].title"),
      uncertainty: stringValue(item.uncertainty),
      url: requiredString(item.url, "items[].url"),
    })),
    mode: resolveMode(source),
    run_id: stringValue(source.run_id),
    status: "completed",
    summary: requiredString(source.summary, "summary"),
    title: stringValue(source.title) || `Nightly Librarian - ${date}`,
  };
  validateDigest(normalized, expectedDate);
  return {
    adapter: "phase1-digest",
    normalized,
  };
}

function candidateItems(source) {
  if (Array.isArray(source.items)) {
    return source.items;
  }
  if (Array.isArray(source.candidates)) {
    return source.candidates;
  }
  if (Array.isArray(source.results)) {
    return source.results;
  }
  return [];
}

function sortableScore(item, field) {
  const value = Number(item[field]);
  return Number.isFinite(value) ? value : 0;
}

function assignDerivedImportance(items) {
  const allExplicit = items.every((item) => item.importance);
  if (allExplicit) {
    return items.map((item) => ({ ...item, importance: normalizeImportance(item.importance) }));
  }

  const promoted = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => PROMOTED_VERDICTS.has(stringValue(item.verdict)))
    .sort((left, right) => (
      sortableScore(right.item, "score_worth_mentioning") - sortableScore(left.item, "score_worth_mentioning") ||
      sortableScore(right.item, "score_decision_impact") - sortableScore(left.item, "score_decision_impact") ||
      left.index - right.index
    ));

  if (promoted.length === 0) {
    throw new Error("Candidate export needs at least one promoted item or explicit importance values.");
  }

  const leadIndex = promoted[0].index;
  const supportingIndexes = new Set(promoted.slice(1, 4).map(({ index }) => index));

  return items.map((item, index) => {
    if (index === leadIndex) {
      return { ...item, importance: "lead" };
    }
    if (supportingIndexes.has(index)) {
      return { ...item, importance: "supporting" };
    }
    return { ...item, importance: "archive-only" };
  });
}

function normalizeCandidateItem(item, index) {
  assertObject(item, `items[${index}]`);

  const url = firstHttpUrl([
    item.url,
    item.source_url,
    item.link,
    item.evidence_sources,
    item.sources,
  ]);
  if (!url) {
    throw new Error(`items[${index}] must include an http(s) source URL.`);
  }

  const sourceFacts = optionalArray(item.source_facts);
  const rawClaim = stringValue(item.raw_claim);
  if (sourceFacts.length === 0 && rawClaim) {
    sourceFacts.push(rawClaim);
  }
  if (sourceFacts.length === 0) {
    throw new Error(`items[${index}] must include source_facts or raw_claim.`);
  }

  const builderTakeaway = stringValue(item.builder_takeaway) ||
    stringValue(item.builder_impact) ||
    stringValue(item.worth_mentioning_reason);
  if (!builderTakeaway) {
    throw new Error(`items[${index}] must include builder_takeaway, builder_impact, or worth_mentioning_reason.`);
  }

  return {
    builder_takeaway: builderTakeaway,
    category: normalizeCategory(item.category),
    id: requiredString(item.id || item.raw_item_id, `items[${index}].id`),
    importance: normalizeImportance(item.importance),
    labels: normalizeLabels(item),
    product_relevance: optionalArray(item.product_relevance),
    published_at: timestampValue(item.published_at, item.discovered_at, item.fetched_at),
    source: stringValue(item.source) || stringValue(item.source_name) || stringValue(item.source_id) || hostFromUrl(url),
    source_facts: sourceFacts,
    title: requiredString(item.title, `items[${index}].title`),
    uncertainty: stringValue(item.uncertainty),
    url,
    verdict: stringValue(item.verdict),
    score_worth_mentioning: item.score_worth_mentioning,
    score_decision_impact: item.score_decision_impact,
  };
}

function stripImportOnlyFields(item) {
  return {
    builder_takeaway: item.builder_takeaway,
    category: item.category,
    id: item.id,
    importance: item.importance,
    labels: item.labels,
    product_relevance: item.product_relevance,
    published_at: item.published_at,
    source: item.source,
    source_facts: item.source_facts,
    title: item.title,
    uncertainty: item.uncertainty,
    url: item.url,
  };
}

function normalizeCandidateExport(source, expectedDate, importMeta) {
  const date = resolveDate(source, expectedDate);
  resolveStatus(source);

  const items = candidateItems(source);
  if (items.length === 0) {
    throw new Error("Source artifact has no structured items, candidates, or results array.");
  }

  const normalizedItems = assignDerivedImportance(items.map(normalizeCandidateItem))
    .map(stripImportOnlyFields);

  const normalized = {
    date,
    generated_at: timestampValue(source.generated_at, source.completed_at, source.reported_at) || `${date}T00:00:00.000Z`,
    imported_from: importMeta,
    items: normalizedItems,
    mode: resolveMode(source),
    run_id: stringValue(source.run_id),
    status: "completed",
    summary: requiredString(source.summary || source.digest_summary || source.run_summary?.summary, "summary"),
    title: stringValue(source.title) || `Nightly Librarian - ${date}`,
  };

  validateDigest(normalized, expectedDate);
  return {
    adapter: "triage-candidate-export",
    normalized,
  };
}

function normalizeDigest(source, expectedDate, importMeta) {
  assertObject(source, "source artifact");

  if (isPhaseOneDigest(source)) {
    return normalizePhaseOneDigest(source, expectedDate, importMeta);
  }

  return normalizeCandidateExport(source, expectedDate, importMeta);
}

function writeOutput(outPath, content, force) {
  if (fs.existsSync(outPath)) {
    const current = fs.readFileSync(outPath, "utf8");
    if (current === content) {
      return "unchanged";
    }
    if (!force) {
      throw new Error(`Output already exists and differs: ${outPath}. Use --force to replace it.`);
    }
    fs.writeFileSync(outPath, content);
    return "updated";
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content);
  return "created";
}

function importDigest({
  date,
  sourcePath,
  outPath = null,
  baseDir = process.cwd(),
  dryRun = false,
  force = false,
}) {
  validateDate(date);
  if (!sourcePath) {
    throw new Error("--source is required.");
  }

  const resolvedSource = path.resolve(baseDir, sourcePath);
  const resolvedOut = path.resolve(baseDir, outPath || path.join("artifacts", "digests", `${date}.json`));
  if (!dryRun && resolvedSource === resolvedOut) {
    throw new Error("--source and --out must be different paths.");
  }

  const source = readJson(resolvedSource);
  const importMeta = {
    importer_version: IMPORTER_VERSION,
    source_artifact: relativePath(baseDir, resolvedSource),
    source_sha256: source.sha256,
  };
  const generation = normalizeDigest(source.parsed, date, importMeta);
  const content = jsonString(generation.normalized);
  const output = relativePath(baseDir, resolvedOut);

  if (dryRun) {
    return {
      adapter: generation.adapter,
      date,
      dry_run: true,
      input: importMeta.source_artifact,
      input_sha256: source.sha256,
      item_count: generation.normalized.items.length,
      output,
      side_effects: {
        credentials: false,
        network: false,
        public_posting: false,
        writes_files: false,
      },
    };
  }

  const status = writeOutput(resolvedOut, content, force);
  return {
    adapter: generation.adapter,
    date,
    dry_run: false,
    input: importMeta.source_artifact,
    input_sha256: source.sha256,
    item_count: generation.normalized.items.length,
    output,
    operation: {
      path: output,
      status,
    },
    side_effects: {
      credentials: false,
      network: false,
      public_posting: false,
      writes_files: status !== "unchanged",
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  const result = importDigest({
    date: args.date,
    sourcePath: args.source,
    outPath: args.out,
    dryRun: args.dryRun,
    force: args.force,
  });
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

module.exports = {
  IMPORTER_VERSION,
  importDigest,
  normalizeDigest,
  parseArgs,
};
