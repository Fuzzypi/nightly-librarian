#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const GENERATOR_VERSION = "social-generate/v1";
const X_LIMIT = 280;
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

function buildBriefMarkdown(digest, metadata) {
  const ordered = orderedItems(digest.items);
  const groups = new Map([
    ["lead", ordered.filter((item) => item.importance === "lead")],
    ["supporting", ordered.filter((item) => item.importance === "supporting")],
    ["archive", ordered.filter((item) => item.importance !== "lead" && item.importance !== "supporting")],
  ]);

  const lines = [
    `# ${digest.title}`,
    "",
    `Date: ${digest.date}`,
    `Status: ${digest.status}`,
    `Mode: ${digest.mode}`,
    `Draft approval: not approved for posting`,
    `Source artifact SHA-256: ${metadata.input_sha256}`,
  ];

  if (digest.mode === "fallback") {
    lines.push("", "> Fallback digest: this output is reduced-confidence and must be reviewed before public use.");
  }

  lines.push("", "## Summary", "", digest.summary);

  let rank = 1;
  for (const [importance, items] of groups.entries()) {
    if (!items.length) {
      continue;
    }
    lines.push("", `## ${headingForImportance(importance)}`, "");
    for (const item of items) {
      lines.push(renderItemMarkdown(item, rank), "");
      rank += 1;
    }
  }

  lines.push("## Source Index", "");
  for (const item of ordered) {
    lines.push(`- [${item.source}: ${item.title}](${item.url})`);
  }

  lines.push("", "<!-- Generated by social-generate/v1. Draft only. -->", "");
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

function fitXPost(index, total, item) {
  const prefix = `${index}/${total} ${item.title}\n\n`;
  const suffix = `\n\nSource: ${item.url}`;
  const labelLine = item.labels.length ? `\nLabels: ${labelList(item.labels)}` : "";
  const fixedLength = prefix.length + "Fact: ".length + "\nBuilder takeaway: ".length + suffix.length + labelLine.length;
  const available = X_LIMIT - fixedLength;
  if (available < 40) {
    throw new Error(`Item ${item.id} cannot fit in an X draft with its source URL.`);
  }

  const factBudget = Math.max(20, Math.floor(available * 0.45));
  const takeawayBudget = Math.max(20, available - factBudget);
  let post = `${prefix}Fact: ${clipText(item.source_facts[0], factBudget)}\nBuilder takeaway: ${clipText(item.builder_takeaway, takeawayBudget)}${labelLine}${suffix}`;

  if (post.length > X_LIMIT) {
    const overflow = post.length - X_LIMIT;
    const shorterTakeawayBudget = Math.max(20, takeawayBudget - overflow - 3);
    post = `${prefix}Fact: ${clipText(item.source_facts[0], factBudget)}\nBuilder takeaway: ${clipText(item.builder_takeaway, shorterTakeawayBudget)}${labelLine}${suffix}`;
  }

  if (post.length > X_LIMIT) {
    throw new Error(`Item ${item.id} produced an X draft over ${X_LIMIT} characters.`);
  }

  return post;
}

function buildXMarkdown(digest, briefPath) {
  const promoted = orderedItems(digest.items).filter((item) => item.importance === "lead" || item.importance === "supporting");
  const total = promoted.length + 1;
  const posts = promoted.map((item, index) => fitXPost(index + 1, total, item));
  const fallbackLine = digest.mode === "fallback" ? "\nFallback digest. Review before public use." : "";
  const finalPost = `${total}/${total} Full local brief draft: ${briefPath}\n\nDraft only. Not approved for posting.${fallbackLine}`;
  if (finalPost.length > X_LIMIT) {
    throw new Error("Final X post exceeds character limit.");
  }
  posts.push(finalPost);
  return `${posts.join("\n\n---\n\n")}\n`;
}

function buildLinkedInMarkdown(digest) {
  const ordered = orderedItems(digest.items);
  const lead = ordered.find((item) => item.importance === "lead");
  const supporting = ordered.filter((item) => item.importance === "supporting");

  const lines = [
    `# LinkedIn Draft - ${digest.date}`,
    "",
  ];

  if (digest.mode === "fallback") {
    lines.push("Fallback digest. Review before public use.", "");
  }

  lines.push(
    digest.summary,
    "",
    "What changed:",
    lead.source_facts[0],
    "",
    "Why it matters:",
    lead.builder_takeaway,
    "",
    "Lead source:",
    `${lead.source}: ${lead.url}`,
  );

  if (supporting.length) {
    lines.push("", "Supporting signals:");
    for (const item of supporting) {
      lines.push(`- ${item.title}: ${item.builder_takeaway} Source: ${item.url}`);
    }
  }

  lines.push("", "Draft status: not approved for posting.", "");
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

  const brief = buildBriefMarkdown(digest, metadata);
  const x = buildXMarkdown(digest, outputPaths.brief);
  const linkedin = buildLinkedInMarkdown(digest);
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
