import type { Gate } from "../types.ts";
import { containsAny } from "../util/text.ts";

export const vendorCheeringGate: Gate = (brief, _selection, editorial) => {
  const matches = containsAny(brief, editorial.vendorCheeringPatterns);
  return {
    gateId: "VG-VENDOR",
    level: "blocking",
    passed: matches.length === 0,
    violations: matches.map(m => `Vendor cheerleading detected: "${m}".`),
  };
};
