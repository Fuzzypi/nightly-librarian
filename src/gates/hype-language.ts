import type { Gate } from "../types.ts";
import { containsAny } from "../util/text.ts";

export const hypeLanguageGate: Gate = (brief, _selection, editorial) => {
  const matches = containsAny(brief, editorial.hypePatterns);
  return {
    gateId: "VG-HYPE",
    level: "blocking",
    passed: matches.length === 0,
    violations: matches.map(m => `Hype language detected: "${m}".`),
  };
};
