import type { Gate } from "../types.ts";

const IGNORE_PATTERNS = [
  "ignore this",
  "skip this",
  "safe to ignore",
  "you can ignore",
  "── ignore",
  "IGNORE THIS",
];

export const noIgnorePileGate: Gate = (brief) => {
  const violations: string[] = [];
  const lower = brief.toLowerCase();

  for (const pattern of IGNORE_PATTERNS) {
    if (lower.includes(pattern.toLowerCase())) {
      violations.push(`Public brief contains ignore-pile language: "${pattern}".`);
    }
  }

  const lines = brief.split("\n");
  for (const line of lines) {
    if (/^#+\s.*ignore/i.test(line) || /^─+\s*ignore/i.test(line)) {
      violations.push(`Section header contains "ignore": "${line.trim()}".`);
    }
  }

  return {
    gateId: "VG-NO-IGNORE",
    level: "blocking",
    passed: violations.length === 0,
    violations,
  };
};
