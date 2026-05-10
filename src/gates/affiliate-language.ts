import type { Gate } from "../types.ts";
import { containsAny } from "../util/text.ts";

export const affiliateLanguageGate: Gate = (brief, _selection, editorial) => {
  const matches = containsAny(brief, editorial.affiliatePatterns);
  return {
    gateId: "VG-AFFILIATE",
    level: "blocking",
    passed: matches.length === 0,
    violations: matches.map(m => `Affiliate language detected: "${m}".`),
  };
};
