#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const USAGE = `Usage:
  npm run report:write -- --date YYYY-MM-DD [--input path|-] [--out reports/YYYY-MM-DD.md] [--dry-run]

Reads JSON output from triage:report and writes the markdown report to a tracked
reports/YYYY-MM-DD.md file. No network access or credentials are used.`;

function nextArg(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Expected value after ${flag}.`);
  }
  return value;
}

function parseArgs(argv) {
  const parsed = {
    date: null,
    input: "-",
    out: null,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--dry-run") {
      parsed.dryRun = true;
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

function validateDate(date) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Expected --date YYYY-MM-DD.");
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid calendar date: ${date}`);
  }
}

function readInput(sourcePath) {
  if (!sourcePath || sourcePath === "-") {
    return fs.readFileSync(0, "utf8");
  }
  return fs.readFileSync(sourcePath, "utf8");
}

function normalizeReportPayload(payload, expectedDate) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Expected triage:report JSON object.");
  }

  const runId = typeof payload.run_id === "string" ? payload.run_id.trim() : "";
  const markdown = typeof payload.markdown === "string" ? payload.markdown.trim() : "";
  if (!runId) {
    throw new Error("triage:report payload is missing run_id.");
  }
  if (!markdown) {
    throw new Error("triage:report payload is missing markdown.");
  }

  if (!markdown.includes("## Worth attention") || !markdown.includes("## Full digest")) {
    throw new Error("triage:report markdown is missing expected sections.");
  }

  const completedMatch = markdown.match(/^Completed:\s+(\d{4}-\d{2}-\d{2})T/m);
  if (completedMatch && completedMatch[1] !== expectedDate) {
    throw new Error(
      `triage:report completed date ${completedMatch[1]} does not match requested date ${expectedDate}.`
    );
  }

  return {
    runId,
    markdown: `${markdown}\n`,
  };
}

function writeReport({ outPath, markdown, dryRun }) {
  if (dryRun) {
    return {
      path: outPath,
      status: fs.existsSync(outPath) ? "would-update" : "would-create",
    };
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  if (fs.existsSync(outPath)) {
    const current = fs.readFileSync(outPath, "utf8");
    if (current === markdown) {
      return { path: outPath, status: "unchanged" };
    }
    fs.writeFileSync(outPath, markdown);
    return { path: outPath, status: "updated" };
  }

  fs.writeFileSync(outPath, markdown);
  return { path: outPath, status: "created" };
}

function writeFromReportResult({ date, inputPath = "-", outPath, dryRun = false, baseDir = process.cwd() }) {
  validateDate(date);

  const resolvedOut = outPath || path.join(baseDir, "reports", `${date}.md`);
  const raw = readInput(inputPath === "-" ? "-" : path.resolve(baseDir, inputPath));
  const payload = JSON.parse(raw);
  const normalized = normalizeReportPayload(payload, date);
  const operation = writeReport({
    outPath: path.resolve(baseDir, resolvedOut),
    markdown: normalized.markdown,
    dryRun,
  });

  return {
    date,
    run_id: normalized.runId,
    output: path.relative(baseDir, operation.path),
    dry_run: dryRun,
    status: operation.status,
    side_effects: {
      network: false,
      writes_files: !dryRun && operation.status !== "unchanged",
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  const result = writeFromReportResult({
    date: args.date,
    inputPath: args.input,
    outPath: args.out,
    dryRun: args.dryRun,
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
  parseArgs,
  writeFromReportResult,
  normalizeReportPayload,
};
