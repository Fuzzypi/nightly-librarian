import type { Gate } from "../types.ts";

export const superlativesGate: Gate = (brief, _selection, editorial) => {
  const violations: string[] = [];
  const lines = brief.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    for (const sup of editorial.bannedSuperlatives) {
      const regex = new RegExp(`\\b${sup}\\b`, "gi");
      if (regex.test(line)) {
        const context = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 2)).join(" ");
        const hasEvidence = /\d+%|\d+x|\$[\d,.]+|benchmark|according to|measured|tested/i.test(context);
        if (!hasEvidence) {
          violations.push(`Unsupported superlative "${sup}" at line ${i + 1} without evidence.`);
        }
      }
    }
  }

  return {
    gateId: "VG-SUPERLATIVE",
    level: "blocking",
    passed: violations.length === 0,
    violations,
  };
};
