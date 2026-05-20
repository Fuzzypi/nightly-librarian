#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const social = require("./social-generate.js");

const APPROVAL_VERSION = "approval/v1";
const APPROVAL_SCHEMA = "nightly-librarian.approval/v1";
const CHANNELS = ["brief", "x", "linkedin"];

const USAGE = `Usage:
  npm run approval:create -- --date YYYY-MM-DD --digest artifacts/digests/YYYY-MM-DD.json --approver NAME --approved-at ISO_TIMESTAMP [--approval artifacts/approvals/YYYY-MM-DD.json] [--channels brief,x,linkedin] [--dry-run] [--force]
  npm run approval:validate -- --date YYYY-MM-DD --digest artifacts/digests/YYYY-MM-DD.json --approval artifacts/approvals/YYYY-MM-DD.json

Creates or validates explicit local approval state for deterministic generated draft artifacts.

No network access, credentials, public posting, scheduling, database connection, or paid integrations are used.`;

function parseArgs(command, argv) {
  const parsed = {
    approval: null,
    approvedAt: null,
    approver: null,
    channels: null,
    command,
    date: null,
    digest: null,
    dryRun: false,
    force: false,
    help: false,
    notes: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--dry-run") {
      parsed.dryRun = true;
    } else if (arg === "--force") {
      parsed.force = true;
    } else if (arg === "--date") {
      parsed.date = nextArg(argv, index, "--date");
      index += 1;
    } else if (arg.startsWith("--date=")) {
      parsed.date = arg.slice("--date=".length);
    } else if (arg === "--digest") {
      parsed.digest = nextArg(argv, index, "--digest");
      index += 1;
    } else if (arg.startsWith("--digest=")) {
      parsed.digest = arg.slice("--digest=".length);
    } else if (arg === "--approval") {
      parsed.approval = nextArg(argv, index, "--approval");
      index += 1;
    } else if (arg.startsWith("--approval=")) {
      parsed.approval = arg.slice("--approval=".length);
    } else if (arg === "--approver") {
      parsed.approver = nextArg(argv, index, "--approver");
      index += 1;
    } else if (arg.startsWith("--approver=")) {
      parsed.approver = arg.slice("--approver=".length);
    } else if (arg === "--approved-at") {
      parsed.approvedAt = nextArg(argv, index, "--approved-at");
      index += 1;
    } else if (arg.startsWith("--approved-at=")) {
      parsed.approvedAt = arg.slice("--approved-at=".length);
    } else if (arg === "--channels") {
      parsed.channels = nextArg(argv, index, "--channels");
      index += 1;
    } else if (arg.startsWith("--channels=")) {
      parsed.channels = arg.slice("--channels=".length);
    } else if (arg === "--notes") {
      parsed.notes = nextArg(argv, index, "--notes");
      index += 1;
    } else if (arg.startsWith("--notes=")) {
      parsed.notes = arg.slice("--notes=".length);
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

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return {
    parsed: JSON.parse(raw),
    raw,
    sha256: sha256(raw),
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

function assertIsoTimestamp(value, field) {
  const text = requiredString(value, field);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(text) || Number.isNaN(new Date(text).getTime())) {
    throw new Error(`${field} must be an ISO-8601 timestamp.`);
  }
  return text;
}

function parseChannels(value) {
  if (!value) {
    return [...CHANNELS];
  }

  const channels = [...new Set(String(value).split(",").map((item) => item.trim()).filter(Boolean))];
  if (channels.length === 0) {
    throw new Error("--channels must include at least one channel.");
  }

  for (const channel of channels) {
    if (!CHANNELS.includes(channel)) {
      throw new Error(`Unknown approval channel: ${channel}.`);
    }
  }

  return channels;
}

function validateChannels(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Approval artifact must include channels_approved.");
  }

  const channels = [...new Set(value.map((item) => stringValue(item)).filter(Boolean))];
  if (channels.length !== value.length) {
    throw new Error("Approval channels must be non-empty strings.");
  }

  for (const channel of channels) {
    if (!CHANNELS.includes(channel)) {
      throw new Error(`Unknown approval channel: ${channel}.`);
    }
  }

  return channels;
}

function assertFreshApproval(approvedAt, digestGeneratedAt) {
  const approvedTime = new Date(assertIsoTimestamp(approvedAt, "approved_at")).getTime();
  const digestTime = new Date(assertIsoTimestamp(digestGeneratedAt, "digest.generated_at")).getTime();
  if (approvedTime < digestTime) {
    throw new Error("Approval artifact is stale: approved_at is before digest.generated_at.");
  }
}

function defaultDigestPath(date) {
  return path.join("artifacts", "digests", `${date}.json`);
}

function defaultApprovalPath(date) {
  return path.join("artifacts", "approvals", `${date}.json`);
}

function socialContentForPath(outputMap, baseDir, relativeOutputPath) {
  const resolved = path.resolve(baseDir, relativeOutputPath);
  const content = outputMap[resolved];
  if (typeof content !== "string") {
    throw new Error(`Generated social output missing for ${relativeOutputPath}.`);
  }
  return content;
}

function buildExpectedBinding({ date, digestPath = null, baseDir = process.cwd() }) {
  validateDate(date);
  const inputPath = digestPath || defaultDigestPath(date);
  const generation = social.buildGeneration({ date, inputPath, baseDir });
  const manifestContent = jsonString(generation.manifest);
  const brief = socialContentForPath(generation.outputMap, baseDir, generation.outputPaths.brief);
  const x = socialContentForPath(generation.outputMap, baseDir, generation.outputPaths.x);
  const linkedin = socialContentForPath(generation.outputMap, baseDir, generation.outputPaths.linkedin);

  return {
    date,
    digest: {
      generated_at: generation.digest.generated_at,
      mode: generation.digest.mode,
      path: generation.manifest.input_artifact,
      sha256: generation.manifest.input_sha256,
      status: generation.digest.status,
    },
    social: {
      brief: {
        path: generation.outputPaths.brief,
        sha256: sha256(brief),
      },
      generator_version: social.GENERATOR_VERSION,
      linkedin: {
        character_count: generation.manifest.channels.linkedin.character_count,
        path: generation.outputPaths.linkedin,
        sha256: sha256(linkedin),
      },
      manifest: {
        path: generation.outputPaths.manifest,
        sha256: sha256(manifestContent),
      },
      x: {
        path: generation.outputPaths.x,
        post_count: generation.manifest.channels.x.post_count,
        sha256: sha256(x),
      },
    },
  };
}

function buildApprovalArtifact({
  approvedAt,
  approver,
  baseDir = process.cwd(),
  channels = null,
  date,
  digestPath = null,
  notes = "",
}) {
  const expected = buildExpectedBinding({ date, digestPath, baseDir });
  const approvalChannels = parseChannels(channels);
  const cleanApprover = requiredString(approver, "approver");
  const cleanApprovedAt = assertIsoTimestamp(approvedAt, "approved_at");
  assertFreshApproval(cleanApprovedAt, expected.digest.generated_at);

  const approval = {
    approved: true,
    approved_at: cleanApprovedAt,
    approval_version: APPROVAL_VERSION,
    approver: cleanApprover,
    channels_approved: approvalChannels,
    date,
    digest: expected.digest,
    policy_checks: {
      digest_completed: true,
      draft_not_published: true,
      facts_labeled: true,
      fallback_labeled: true,
      not_stale: true,
      source_links_preserved: true,
    },
    schema: APPROVAL_SCHEMA,
    social: expected.social,
    status: "approved",
  };

  const cleanNotes = stringValue(notes);
  if (cleanNotes) {
    approval.notes = cleanNotes;
  }

  return approval;
}

function writeOutput(outPath, content, force) {
  if (fs.existsSync(outPath)) {
    const current = fs.readFileSync(outPath, "utf8");
    if (current === content) {
      return "unchanged";
    }
    if (!force) {
      throw new Error(`Approval output already exists and differs: ${outPath}. Use --force to replace it.`);
    }
    fs.writeFileSync(outPath, content);
    return "updated";
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content);
  return "created";
}

function createApproval({
  approvalPath = null,
  approvedAt,
  approver,
  baseDir = process.cwd(),
  channels = null,
  date,
  digestPath = null,
  dryRun = false,
  force = false,
  notes = "",
}) {
  const approval = buildApprovalArtifact({ approvedAt, approver, baseDir, channels, date, digestPath, notes });
  const outputPath = path.resolve(baseDir, approvalPath || defaultApprovalPath(date));
  const output = relativePath(baseDir, outputPath);
  const content = jsonString(approval);

  if (dryRun) {
    return {
      approval: output,
      approved: true,
      channels_approved: approval.channels_approved,
      date,
      digest: approval.digest.path,
      dry_run: true,
      side_effects: {
        credentials: false,
        network: false,
        public_posting: false,
        writes_files: false,
      },
      social_manifest: approval.social.manifest.path,
    };
  }

  const status = writeOutput(outputPath, content, force);
  return {
    approval: output,
    approved: true,
    channels_approved: approval.channels_approved,
    date,
    digest: approval.digest.path,
    dry_run: false,
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
    social_manifest: approval.social.manifest.path,
  };
}

function requireEqual(actual, expected, field) {
  if (actual !== expected) {
    throw new Error(`${field} mismatch: expected ${expected}; received ${actual}.`);
  }
}

function validatePolicyChecks(policyChecks) {
  assertObject(policyChecks, "policy_checks");
  const requiredChecks = [
    "digest_completed",
    "draft_not_published",
    "facts_labeled",
    "fallback_labeled",
    "not_stale",
    "source_links_preserved",
  ];

  for (const check of requiredChecks) {
    if (policyChecks[check] !== true) {
      throw new Error(`Approval policy check must be true: ${check}.`);
    }
  }
}

function validateSocialBinding(actual, expected) {
  assertObject(actual, "social");
  requireEqual(actual.generator_version, expected.generator_version, "social.generator_version");

  for (const field of ["manifest", "brief", "x", "linkedin"]) {
    assertObject(actual[field], `social.${field}`);
    requireEqual(actual[field].path, expected[field].path, `social.${field}.path`);
    requireEqual(actual[field].sha256, expected[field].sha256, `social.${field}.sha256`);
  }

  requireEqual(actual.x.post_count, expected.x.post_count, "social.x.post_count");
  requireEqual(actual.linkedin.character_count, expected.linkedin.character_count, "social.linkedin.character_count");
}

function validateApproval({
  approvalPath = null,
  baseDir = process.cwd(),
  date,
  digestPath = null,
}) {
  validateDate(date);
  const resolvedApproval = path.resolve(baseDir, approvalPath || defaultApprovalPath(date));
  const approval = relativePath(baseDir, resolvedApproval);
  if (!fs.existsSync(resolvedApproval)) {
    throw new Error(`Approval artifact missing: ${approval}. Absence means not approved.`);
  }

  const expected = buildExpectedBinding({ date, digestPath, baseDir });
  const { parsed } = readJson(resolvedApproval);
  assertObject(parsed, "approval artifact");

  requireEqual(parsed.schema, APPROVAL_SCHEMA, "approval.schema");
  requireEqual(parsed.approval_version, APPROVAL_VERSION, "approval.approval_version");
  requireEqual(parsed.date, date, "approval.date");
  requireEqual(parsed.status, "approved", "approval.status");
  if (parsed.approved !== true) {
    throw new Error("Approval artifact must include approved: true.");
  }

  requiredString(parsed.approver, "approver");
  assertFreshApproval(parsed.approved_at, expected.digest.generated_at);
  const channels = validateChannels(parsed.channels_approved);

  assertObject(parsed.digest, "digest");
  for (const field of ["generated_at", "mode", "path", "sha256", "status"]) {
    requireEqual(parsed.digest[field], expected.digest[field], `digest.${field}`);
  }

  validateSocialBinding(parsed.social, expected.social);
  validatePolicyChecks(parsed.policy_checks);

  return {
    approval,
    approved: true,
    channels_approved: channels,
    date,
    digest: expected.digest.path,
    digest_sha256: expected.digest.sha256,
    side_effects: {
      credentials: false,
      network: false,
      public_posting: false,
      writes_files: false,
    },
    social_manifest: expected.social.manifest.path,
    social_manifest_sha256: expected.social.manifest.sha256,
  };
}

function main() {
  const command = process.argv[2];
  if (!command || command === "--help" || command === "-h") {
    console.log(USAGE);
    return command ? 0 : 2;
  }
  if (!["create", "validate"].includes(command)) {
    throw new Error(`Unknown approval command: ${command}.`);
  }

  const args = parseArgs(command, process.argv.slice(3));
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  const result = command === "create"
    ? createApproval({
        approvalPath: args.approval,
        approvedAt: args.approvedAt,
        approver: args.approver,
        channels: args.channels,
        date: args.date,
        digestPath: args.digest,
        dryRun: args.dryRun,
        force: args.force,
        notes: args.notes,
      })
    : validateApproval({
        approvalPath: args.approval,
        date: args.date,
        digestPath: args.digest,
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
  APPROVAL_SCHEMA,
  APPROVAL_VERSION,
  buildApprovalArtifact,
  buildExpectedBinding,
  createApproval,
  parseArgs,
  validateApproval,
};
