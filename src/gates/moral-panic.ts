import type { Gate } from "../types.ts";
import { containsAny } from "../util/text.ts";

export const moralPanicGate: Gate = (brief, _selection, editorial) => {
  const matches = containsAny(brief, editorial.moralPanicPatterns);
  return {
    gateId: "VG-PANIC",
    level: "blocking",
    passed: matches.length === 0,
    violations: matches.map(m => `Moral panic framing detected: "${m}".`),
  };
};
