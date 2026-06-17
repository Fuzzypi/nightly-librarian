#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const GENERATOR_VERSION = "social-generate/v4";
const X_LIMIT = 280;
const DEFAULT_PUBLIC_BASE_URL = "https://thenightlylibrarian.com";
const DEFAULT_BRIEF_PATH_TEMPLATE = "/briefs/{date}";
const IMPORTANCE_ORDER = new Map([
  ["lead", 0],
  ["supporting", 1],
  ["archive", 2],
  ["archive-only", 2],
]);

const USAGE = `Usage:
  npm run social:generate -- --date YYYY-MM-DD [--input path] [--dry-run] [--force]

Reads a completed local digest JSON artifact and generates:
  dist/briefs/YYYY-MM-DD.md
  dist/social/YYYY-MM-DD.json
  dist/social/YYYY-MM-DD.x.md
  dist/social/YYYY-MM-DD.linkedin.md

No network access, credentials, public posting, or paid integrations are used.`;

function parseArgs(argv) {
  const parsed = {
    date: null,
    input: null,
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
    } else if (arg === "--input") {
      parsed.input = nextArg(argv, i, "--input");
      i += 1;
    } else if (arg.startsWith("--input=")) {
      parsed.input = arg.slice("--input=".length);
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

function assertString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required string field: ${field}`);
  }
  return value.trim();
}

function optionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function assertIsoTimestamp(value, field) {
  const timestamp = assertString(value, field);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(timestamp) || Number.isNaN(new Date(timestamp).getTime())) {
    throw new Error(`${field} must be an ISO-8601 timestamp.`);
  }
  return timestamp;
}

function assertStringArray(value, field) {
  if (!Array.isArray(value) || value.length === 0 || !value.every((item) => typeof item === "string" && item.trim())) {
    throw new Error(`Expected non-empty string array: ${field}`);
  }
  return value.map((item) => item.trim());
}

function optionalStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function validateDigest(digest, expectedDate) {
  if (!digest || typeof digest !== "object" || Array.isArray(digest)) {
    throw new Error("Digest artifact must be a JSON object.");
  }

  const date = assertString(digest.date, "date");
  validateDate(date);
  if (date !== expectedDate) {
    throw new Error(`Digest date ${date} does not match requested date ${expectedDate}.`);
  }

  const status = assertString(digest.status, "status");
  if (status !== "completed") {
    throw new Error(`Digest status must be completed; received ${status}.`);
  }

  const mode = assertString(digest.mode, "mode");
  if (!["primary", "fallback"].includes(mode)) {
    throw new Error(`Digest mode must be primary or fallback; received ${mode}.`);
  }

  const title = assertString(digest.title, "title");
  const summary = assertString(digest.summary, "summary");

  if (!Array.isArray(digest.items) || digest.items.length === 0) {
    throw new Error("Digest must include at least one item.");
  }

  const items = digest.items.map((item, index) => normalizeItem(item, index));
  const leadCount = items.filter((item) => item.importance === "lead").length;
  if (leadCount !== 1) {
    throw new Error(`Digest must include exactly one lead item; found ${leadCount}.`);
  }

  const generatedAt = optionalString(digest.generated_at) || `${date}T00:00:00.000Z`;

  return {
    date,
    status,
    mode,
    title,
    summary,
    generated_at: assertIsoTimestamp(generatedAt, "generated_at"),
    run_id: optionalString(digest.run_id),
    items,
  };
}

function normalizeItem(item, index) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new Error(`Item ${index + 1} must be an object.`);
  }

  const id = assertString(item.id, `items[${index}].id`);
  const title = assertString(item.title, `items[${index}].title`);
  const url = assertString(item.url, `items[${index}].url`);
  if (!isHttpUrl(url)) {
    throw new Error(`items[${index}].url must be an http(s) URL.`);
  }

  const publishedAt = assertIsoTimestamp(item.published_at, `items[${index}].published_at`);

  const importance = assertString(item.importance, `items[${index}].importance`);
  if (!IMPORTANCE_ORDER.has(importance)) {
    throw new Error(`items[${index}].importance must be lead, supporting, archive, or archive-only.`);
  }

  return {
    id,
    title,
    url,
    source: assertString(item.source, `items[${index}].source`),
    published_at: publishedAt,
    category: assertString(item.category, `items[${index}].category`),
    importance,
    source_facts: assertStringArray(item.source_facts, `items[${index}].source_facts`),
    builder_takeaway: assertString(item.builder_takeaway, `items[${index}].builder_takeaway`),
    product_relevance: optionalStringArray(item.product_relevance),
    labels: optionalStringArray(item.labels),
    uncertainty: optionalString(item.uncertainty),
    original_index: index,
  };
}

function orderedItems(items) {
  return [...items].sort((left, right) => {
    const byImportance = IMPORTANCE_ORDER.get(left.importance) - IMPORTANCE_ORDER.get(right.importance);
    if (byImportance !== 0) {
      return byImportance;
    }
    return left.original_index - right.original_index;
  });
}

function headingForImportance(importance) {
  if (importance === "lead") {
    return "Lead Story";
  }
  if (importance === "supporting") {
    return "Supporting Stories";
  }
  return "Archive-Only Items";
}

function labelList(values) {
  return values.length ? values.join(", ") : "none";
}

function markdownList(items, prefix = "- ") {
  return items.map((item) => `${prefix}${item}`).join("\n");
}

function cleanClause(value) {
  return optionalString(value)
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/g, "");
}

function sentence(value) {
  const clause = cleanClause(value);
  return clause ? `${clause}.` : "";
}

function phraseList(values) {
  if (values.length === 0) {
    return "";
  }
  if (values.length === 1) {
    return values[0];
  }
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function buildDailyLeadParagraph(digest, lead, published, monitored, categories) {
  const parts = [];
  const themeText = phraseList(categories);
  parts.push(themeText ? `Tonight's brief tracks ${themeText}.` : "Tonight's brief tracks a mixed set of signals.");

  const digestSummary = sentence(digest.summary);
  if (digestSummary) {
    parts.push(digestSummary);
  }

  if (lead) {
    const leadFact = lead.source_facts[0] || "";
    const sourceSignal = sentence(leadFact || lead.builder_takeaway);
    if (sourceSignal) {
      parts.push(`The lead source signal is ${lead.title}: ${sourceSignal}`);
    }

    const leadTakeaway = sentence(cleanSignal(lead.builder_takeaway));
    if (leadTakeaway) {
      parts.push(`The operator read is ${leadTakeaway}`);
    }
  }

  const supporting = published.filter((item) => item.id !== lead?.id).slice(0, 2);
  if (supporting.length) {
    const signals = supporting
      .map((item) => `${item.title} (${cleanClause(cleanSignal(item.builder_takeaway))})`)
      .join("; ");
    parts.push(`Supporting context: ${signals}.`);
  }

  if (monitored.length) {
    const watchList = monitored
      .slice(0, 2)
      .map((item) => `${item.title} (${cleanClause(cleanSignal(item.builder_takeaway))})`)
      .join("; ");
    parts.push(`Monitor-only context stays out of the publish list until reviewed: ${watchList}.`);
  }

  return parts.join(" ");
}

function renderItemMarkdown(item, rank) {
  const lines = [
    `### ${rank}. ${item.title}`,
    "",
    `- Source: [${item.source}](${item.url})`,
    `- Category: ${item.category}`,
    `- Published: ${item.published_at}`,
    `- Labels: ${labelList(item.labels)}`,
    `- Product relevance: ${labelList(item.product_relevance)}`,
    "",
    "Source facts:",
    markdownList(item.source_facts),
    "",
    `Builder/operator takeaway: ${item.builder_takeaway}`,
  ];

  if (item.uncertainty) {
    lines.push("", `Uncertainty: ${item.uncertainty}`);
  }

  return lines.join("\n");
}

function buildBriefMarkdown(digest, metadata, landingUrl) {
  const ordered = orderedItems(digest.items);

  const lead = ordered.find((item) => item.importance === "lead");
  const published = ordered.filter((item) => verdictForItem(item) === "publish");
  const monitored = ordered.filter((item) => verdictForItem(item) === "monitor");
  const rejected = ordered.filter((item) => verdictForItem(item) === "reject");

  const categories = [...new Set([lead, ...published, ...monitored].filter(Boolean).map((item) => item.category))].slice(0, 4);

  const lines = [
    `# ${digest.title}`,
    "",
    `Date: ${digest.date}`,
    `Status: ${digest.status}`,
    `Mode: ${digest.mode}`,
    `Draft approval: not approved for posting`,
    `Landing page: ${landingUrl}`,
    `Source artifact SHA-256: ${metadata.input_sha256}`,
  ];

  if (digest.mode === "fallback") {
    lines.push("", "> Fallback digest: this output is reduced-confidence and must be reviewed before public use.");
  }

  lines.push(
    "",
    "## Daily summary",
    "",
    categories.length ? `Themes: ${categories.join(" • ")}.` : "Themes: mixed.",
    "",
    buildDailyLeadParagraph(digest, lead, published, monitored, categories),
  );

  if (published.length) {
    lines.push("", "## Worth mentioning", "");
    let rank = 1;
    for (const item of published) {
      lines.push(renderItemMarkdown(item, rank), "");
      rank += 1;
    }
  }

  if (monitored.length) {
    lines.push("", "## Monitor (keep an eye on it)", "");
    let rank = published.length + 1;
    for (const item of monitored) {
      lines.push(renderItemMarkdown(item, rank), "");
      rank += 1;
    }
  }

  lines.push(
    "",
    "## All researched links (complete index)",
    "",
    "> Included for transparency. Items tagged [R] were researched but not recommended.",
    "",
  );
  for (const item of ordered) {
    lines.push(`- ${verdictTag(item)} [${item.title}](${item.url})`);
  }

  lines.push(
    "",
    "## Rejected items (not recommended)",
    "",
    `Rejected: ${rejected.length}`,
    "",
    `<!-- Generated by ${GENERATOR_VERSION}. Draft only. -->`,
    "",
  );
  return lines.join("\n");
}

function clipText(value, maxLength) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }
  if (maxLength <= 3) {
    return ".".repeat(Math.max(0, maxLength));
  }
  const clipped = text.slice(0, maxLength - 3).trimEnd();
  const lastSpace = clipped.lastIndexOf(" ");
  const wordSafe = lastSpace > Math.floor(maxLength * 0.6) ? clipped.slice(0, lastSpace) : clipped;
  return `${wordSafe.trimEnd()}...`;
}

function normalizeBaseUrl(value) {
  const text = optionalString(value);
  if (!text) {
    return DEFAULT_PUBLIC_BASE_URL;
  }
  return text.replace(/\/+$/, "");
}

function briefPathTemplate() {
  return optionalString(process.env.NIGHTLY_LIBRARIAN_BRIEF_PATH_TEMPLATE) || DEFAULT_BRIEF_PATH_TEMPLATE;
}

function landingUrlForDate(date, utmSource = "") {
  const baseUrl = normalizeBaseUrl(process.env.NIGHTLY_LIBRARIAN_PUBLIC_BASE_URL);
  const template = briefPathTemplate();
  const url = `${baseUrl}${template.replace("{date}", date)}`;
  if (!utmSource) return url;
  return `${url}?utm_source=${utmSource}&utm_medium=social&utm_campaign=daily-brief`;
}

function hasLabel(item, label) {
  const normalized = item.labels.map((value) => value.toLowerCase());
  return normalized.includes(label.toLowerCase());
}

function verdictForItem(item) {
  if (hasLabel(item, "publish_public") || hasLabel(item, "publish_private")) {
    return "publish";
  }
  if (hasLabel(item, "monitor")) {
    return "monitor";
  }
  return "reject";
}

function verdictTag(item) {
  const verdict = verdictForItem(item);
  if (verdict === "publish") {
    return "[P]";
  }
  if (verdict === "monitor") {
    return "[M]";
  }
  return "[R]";
}

// Trim hedging openers that read poorly as standalone short signals, then re-capitalize.
// Applied consistently across X and LinkedIn templates.
function cleanSignal(text) {
  const cleaned = text
    .replace(/^This is (a |an )/i, "")
    .replace(/^If true, /i, "")
    .replace(/^Note that /i, "")
    .replace(/^Worth noting: /i, "")
    .trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function buildXMarkdown(digest, landingUrl) {
  const ordered = orderedItems(digest.items);
  const lead = ordered.find((item) => item.importance === "lead");
  const promoted = ordered.filter((item) => verdictForItem(item) === "publish" && item.id !== lead.id);
  const fallbackNote = digest.mode === "fallback" ? "\n\nFallback digest—review before posting." : "";

  // Open with the sharpest concrete signal: prefer first source fact (the actual finding),
  // fall back to builder_takeaway when the fact is too short to stand alone (e.g. just a title).
  const firstFact = lead.source_facts.length > 0 ? lead.source_facts[0] : "";
  const hook = firstFact.length >= 40
    ? clipText(firstFact, 200)
    : clipText(lead.builder_takeaway, 200);

  const draftLine = `\n\nDraft only. Not approved for posting.${fallbackNote}`;

  // Supporting signals formatted as compact add-ons (no label prefix — the content speaks)
  function signalsBlock(count) {
    if (count <= 0) return "";
    const signals = promoted.slice(0, count).map((item) => clipText(cleanSignal(item.builder_takeaway), 65));
    return `\n\n+ ${signals.join("\n+ ")}`;
  }

  // Try: hook + supporting signals + url + draft notice (single post)
  for (let count = Math.min(2, promoted.length); count >= 0; count -= 1) {
    const candidate = `${hook}${signalsBlock(count)}\n\n${landingUrl}${draftLine}`;
    if (candidate.length <= X_LIMIT) {
      return `${candidate}\n`;
    }
  }

  // Thread fallback — post 1 is the hook, post 2 adds signals + link
  const post1 = `${clipText(hook, X_LIMIT - draftLine.length - 2)}${draftLine}`;
  if (post1.length > X_LIMIT) {
    throw new Error("X teaser could not fit the lead summary under character limits.");
  }

  for (let count = Math.min(3, promoted.length); count >= 0; count -= 1) {
    const post2 = `${signalsBlock(count).trimStart()}${count > 0 ? "\n\n" : ""}${landingUrl}`;
    if (post2.length <= X_LIMIT) {
      return `${post1}\n\n---\n\n${post2}\n`;
    }
  }

  const minimal = landingUrl;
  if (minimal.length > X_LIMIT) {
    throw new Error("Landing URL is too long for an X teaser post.");
  }
  return `${post1}\n\n---\n\n${minimal}\n`;
}

function buildLinkedInMarkdown(digest, landingUrl) {
  const ordered = orderedItems(digest.items);
  const lead = ordered.find((item) => item.importance === "lead");
  const promoted = ordered.filter((item) => verdictForItem(item) === "publish" && item.id !== lead.id);
  const allResearched = ordered.length;
  if (!landingUrl) landingUrl = landingUrlForDate(digest.date, "linkedin");

  const lines = [
    `# LinkedIn Draft - ${digest.date}`,
    "",
  ];

  if (digest.mode === "fallback") {
    lines.push("⚠ Fallback digest. Review before public use.", "");
  }

  // Open with the sharpest concrete signal — the thing that should stop the scroll.
  // Use first source fact if it's substantive; fall back to builder_takeaway for short/title-only facts.
  const leadFact = lead.source_facts.length > 0 ? lead.source_facts[0] : "";
  const opener = leadFact.length >= 40
    ? leadFact
    : lead.builder_takeaway;

  lines.push(opener, "");

  // Context line — establishes the brief's value before the list
  lines.push(
    `Went through ${allResearched} links today. Here's what made the brief:`,
    "",
  );

  // Lead item as #1
  lines.push(`1. ${lead.title}`);
  lines.push(`   ${cleanSignal(lead.builder_takeaway)}`);
  lines.push("");

  // Supporting published items
  if (promoted.length) {
    let rank = 2;
    for (const item of promoted.slice(0, 4)) {
      lines.push(`${rank}. ${item.title}`);
      lines.push(`   ${clipText(cleanSignal(item.builder_takeaway), 160)}`);
      lines.push("");
      rank += 1;
    }
  }

  // CTA — specific and worth clicking
  lines.push(
    `Full brief with all ${allResearched} researched links → ${landingUrl}`,
    "",
    "Draft status: not approved for posting.",
    "",
  );
  return lines.join("\n");
}

function claimTypeForLabels(labels) {
  const normalized = labels.map((label) => label.toLowerCase());
  if (normalized.includes("rumor") || normalized.includes("unverified")) {
    return "rumor";
  }
  if (normalized.includes("benchmark")) {
    return "benchmark";
  }
  if (normalized.includes("opinion")) {
    return "opinion";
  }
  if (normalized.includes("launch") || normalized.includes("api-change")) {
    return "launch";
  }
  return "source_fact";
}

function buildManifest(digest, metadata, outputPaths, channelStats) {
  return {
    approved: false,
    channels: {
      brief: {
        path: outputPaths.brief,
      },
      linkedin: {
        character_count: channelStats.linkedin.length,
        path: outputPaths.linkedin,
      },
      x: {
        character_counts: channelStats.xPosts.map((post) => post.length),
        path: outputPaths.x,
        post_count: channelStats.xPosts.length,
      },
    },
    date: digest.date,
    fallback: digest.mode === "fallback",
    generated_at: digest.generated_at,
    generator_version: GENERATOR_VERSION,
    input_artifact: metadata.input_artifact,
    input_sha256: metadata.input_sha256,
    item_count: digest.items.length,
    landing_url: landingUrlForDate(digest.date),
    mode: digest.mode,
    sources: orderedItems(digest.items).map((item) => ({
      category: item.category,
      claim_type: claimTypeForLabels(item.labels),
      id: item.id,
      importance: item.importance,
      labels: item.labels,
      source: item.source,
      title: item.title,
      url: item.url,
    })),
    status: "draft",
    summary: digest.summary,
    title: digest.title,
  };
}

function splitXPosts(xMarkdown) {
  return xMarkdown.trimEnd().split(/\n\n---\n\n/);
}

function ensureNoApprovedOverwrite(manifestPath, nextManifest, outputMap, force) {
  if (!fs.existsSync(manifestPath)) {
    return;
  }

  let existingManifest = null;
  try {
    existingManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    if (!force) {
      throw new Error(`Existing manifest is not valid JSON: ${manifestPath}`);
    }
  }

  const changed = Object.entries(outputMap).some(([filePath, content]) => (
    fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8") !== content
  ));

  if (existingManifest?.approved === true && changed) {
    throw new Error("Refusing to overwrite approved social output.");
  }

  if (changed && !force && existingManifest) {
    const differentInputOrVersion = existingManifest.input_sha256 !== nextManifest.input_sha256 ||
      existingManifest.generator_version !== nextManifest.generator_version;
    if (!differentInputOrVersion) {
      throw new Error("Existing output differs for the same input hash and generator version. Use --force to replace it.");
    }
  }
}

function writeOutputs(outputMap, manifestPath, manifest, force) {
  ensureNoApprovedOverwrite(manifestPath, manifest, outputMap, force);
  const operations = [];

  for (const [filePath, content] of Object.entries(outputMap)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (fs.existsSync(filePath)) {
      const current = fs.readFileSync(filePath, "utf8");
      if (current === content) {
        operations.push({ path: filePath, status: "unchanged" });
        continue;
      }
      fs.writeFileSync(filePath, content);
      operations.push({ path: filePath, status: "updated" });
      continue;
    }

    fs.writeFileSync(filePath, content);
    operations.push({ path: filePath, status: "created" });
  }

  return operations;
}

function buildGeneration({ date, inputPath, baseDir = process.cwd() }) {
  validateDate(date);
  const resolvedInput = path.resolve(baseDir, inputPath || path.join("artifacts", "digests", `${date}.json`));
  const { raw, parsed, sha256 } = readJson(resolvedInput);
  const digest = validateDigest(parsed, date);
  const landingUrl = landingUrlForDate(date);
  const xLandingUrl = landingUrlForDate(date, "x");
  const linkedinLandingUrl = landingUrlForDate(date, "linkedin");
  const inputArtifact = relativePath(baseDir, resolvedInput);
  const outputPaths = {
    brief: normalizeSlash(path.join("dist", "briefs", `${date}.md`)),
    manifest: normalizeSlash(path.join("dist", "social", `${date}.json`)),
    x: normalizeSlash(path.join("dist", "social", `${date}.x.md`)),
    linkedin: normalizeSlash(path.join("dist", "social", `${date}.linkedin.md`)),
  };
  const metadata = {
    input_artifact: inputArtifact,
    input_bytes: Buffer.byteLength(raw, "utf8"),
    input_sha256: sha256,
  };

  const brief = buildBriefMarkdown(digest, metadata, landingUrl);
  const x = buildXMarkdown(digest, xLandingUrl);
  const linkedin = buildLinkedInMarkdown(digest, linkedinLandingUrl);
  const xPosts = splitXPosts(x);
  const manifest = buildManifest(digest, metadata, outputPaths, { xPosts, linkedin });

  return {
    digest,
    manifest,
    outputPaths,
    outputMap: {
      [path.resolve(baseDir, outputPaths.brief)]: brief,
      [path.resolve(baseDir, outputPaths.manifest)]: jsonString(manifest),
      [path.resolve(baseDir, outputPaths.x)]: x,
      [path.resolve(baseDir, outputPaths.linkedin)]: linkedin,
    },
  };
}

function generate({ date, inputPath = null, baseDir = process.cwd(), dryRun = false, force = false }) {
  const generation = buildGeneration({ date, inputPath, baseDir });
  const resolvedManifest = path.resolve(baseDir, generation.outputPaths.manifest);
  const planned = Object.keys(generation.outputMap).map((filePath) => relativePath(baseDir, filePath));

  if (dryRun) {
    return {
      date,
      dry_run: true,
      gating: {
        input_valid: true,
        status: generation.digest.status,
        mode: generation.digest.mode,
        approved: false,
      },
      input: generation.manifest.input_artifact,
      input_sha256: generation.manifest.input_sha256,
      outputs: generation.outputPaths,
      planned_writes: planned,
      side_effects: {
        network: false,
        public_posting: false,
        writes_files: false,
      },
    };
  }

  const operations = writeOutputs(generation.outputMap, resolvedManifest, generation.manifest, force)
    .map((operation) => ({
      path: relativePath(baseDir, operation.path),
      status: operation.status,
    }));

  return {
    date,
    dry_run: false,
    input: generation.manifest.input_artifact,
    input_sha256: generation.manifest.input_sha256,
    operations,
    outputs: generation.outputPaths,
    side_effects: {
      network: false,
      public_posting: false,
      writes_files: operations.some((operation) => operation.status !== "unchanged"),
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  const result = generate({
    date: args.date,
    inputPath: args.input,
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
  GENERATOR_VERSION,
  X_LIMIT,
  buildGeneration,
  generate,
  parseArgs,
  validateDigest,
};
