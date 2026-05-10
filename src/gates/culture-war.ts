import type { Gate } from "../types.ts";
import { containsAny } from "../util/text.ts";

export const cultureWarGate: Gate = (brief, _selection, editorial) => {
  const matches = containsAny(brief, editorial.cultureWarPatterns);
  return {
    gateId: "VG-CULTURE",
    level: "blocking",
    passed: matches.length === 0,
    violations: matches.map(m => `Culture-war framing detected: "${m}".`),
  };
};
