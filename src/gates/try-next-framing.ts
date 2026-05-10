import type { Gate } from "../types.ts";
import { containsAny } from "../util/text.ts";

export const tryNextFramingGate: Gate = (brief, _selection, editorial) => {
  const matches = containsAny(brief, editorial.tryNextPatterns);
  return {
    gateId: "VG-TRY-NEXT",
    level: "blocking",
    passed: matches.length === 0,
    violations: matches.map(m => `"Try next" framing detected: "${m}".`),
  };
};
