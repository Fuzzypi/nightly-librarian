import type { Gate } from "../types.ts";
import { containsAny } from "../util/text.ts";

export const partisanGate: Gate = (brief, _selection, editorial) => {
  const matches = containsAny(brief, editorial.partisanPatterns);
  return {
    gateId: "VG-PARTISAN",
    level: "blocking",
    passed: matches.length === 0,
    violations: matches.map(m => `Partisan commentary detected: "${m}".`),
  };
};
