import type { Gate } from "../types.ts";
import { containsAny } from "../util/text.ts";

export const sponsorExplainGate: Gate = (brief, _selection, editorial) => {
  const violations: string[] = [];
  const sponsorLine = brief.split("\n").find(l => l.startsWith("Brought to you by"));
  const afterSponsor = sponsorLine ? brief.slice(brief.indexOf(sponsorLine) + sponsorLine.length) : brief;

  const matches = containsAny(afterSponsor, editorial.sponsorExplainPatterns);
  for (const match of matches) {
    violations.push(`Sponsor explanation pattern found: "${match}".`);
  }

  return {
    gateId: "VG-SPONSOR-EXPLAIN",
    level: "blocking",
    passed: violations.length === 0,
    violations,
  };
};
