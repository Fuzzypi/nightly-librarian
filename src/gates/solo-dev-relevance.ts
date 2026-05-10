import type { Gate } from "../types.ts";
import { wordCount } from "../util/text.ts";

export const soloDevRelevanceGate: Gate = (brief) => {
  const violations: string[] = [];
  const signalsSection = brief.match(/─── THE 5 SIGNALS ─+\n([\s\S]*?)(?=─── TRY THIS)/)?.[1] ?? "";
  const impacts = signalsSection.match(/BUILDER IMPACT: .+/g) ?? [];

  for (const impact of impacts) {
    const text = impact.replace("BUILDER IMPACT: ", "");
    const wc = wordCount(text);
    if (wc < 10) {
      violations.push(`BUILDER IMPACT too short (${wc} words, need ≥10): "${text.substring(0, 60)}..."`);
    }
  }

  return {
    gateId: "VG-RELEVANCE",
    level: "blocking",
    passed: violations.length === 0,
    violations,
  };
};
