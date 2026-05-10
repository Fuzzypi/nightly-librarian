import type { Gate } from "../types.ts";
import { hoursAgo } from "../util/date.ts";

export const staleCheckGate: Gate = (brief, selection) => {
  const violations: string[] = [];
  const briefLines = brief.split("\n");

  for (const signal of selection.signals) {
    const age = hoursAgo(signal.publishedAt);
    if (age > 28) {
      const signalInBrief = briefLines.some(l => l.includes(signal.title));
      const hasContextMarker = briefLines.some(l => l.includes(signal.title) && l.includes("[CONTEXT]"));
      if (signalInBrief && !hasContextMarker) {
        violations.push(`Signal "${signal.title}" is ${Math.round(age)}h old without [CONTEXT] marker.`);
      }
    }
  }

  return {
    gateId: "VG-STALE",
    level: "blocking",
    passed: violations.length === 0,
    violations,
  };
};
