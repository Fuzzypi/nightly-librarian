#!/usr/bin/env node
"use strict";

const USAGE = `Usage:
  npm run social:generate -- --date YYYY-MM-DD --dry-run

This is a contract stub. It validates arguments and prints the planned artifact
paths, but it does not read secrets, access the network, write outputs, or post
to any public channel.`;

function parseArgs(argv) {
  const parsed = {
    date: null,
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
      parsed.date = argv[i + 1] || null;
      i += 1;
    } else if (arg.startsWith("--date=")) {
      parsed.date = arg.slice("--date=".length);
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  validateDate(args.date);

  if (!args.dryRun) {
    throw new Error("Only --dry-run is supported until generation is implemented.");
  }

  console.log(JSON.stringify({
    status: "stub",
    date: args.date,
    input: `artifacts/digests/${args.date}.json`,
    outputs: {
      brief: `dist/briefs/${args.date}.md`,
      manifest: `dist/social/${args.date}.json`,
      x: `dist/social/${args.date}.x.md`,
      linkedin: `dist/social/${args.date}.linkedin.md`,
    },
    side_effects: {
      writes_files: false,
      network: false,
      public_posting: false,
    },
    contract: "docs/social-generation-contract.md",
  }, null, 2));

  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  console.error(USAGE);
  process.exitCode = 2;
}
