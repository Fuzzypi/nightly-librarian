import type { Gate } from "../types.ts";
import { jaccardSimilarity, levenshteinRatio } from "../util/text.ts";

export const dedupPublicGate: Gate = (_brief, selection) => {
  const violations: string[] = [];
  const signals = selection.signals;

  for (let i = 0; i < signals.length; i++) {
    for (let j = i + 1; j < signals.length; j++) {
      const entitySim = jaccardSimilarity(signals[i].entities, signals[j].entities);
      if (entitySim >= 0.6) {
        violations.push(
          `Signals "${signals[i].title}" and "${signals[j].title}" have entity overlap ${(entitySim * 100).toFixed(0)}% (≥60%).`
        );
        continue;
      }

      const titleSim = levenshteinRatio(signals[i].title, signals[j].title);
      if (titleSim >= 0.7) {
        violations.push(
          `Signals "${signals[i].title}" and "${signals[j].title}" have title similarity ${(titleSim * 100).toFixed(0)}% (≥70%).`
        );
        continue;
      }

      const sameSource = signals[i].sourceRefs.some(a =>
        signals[j].sourceRefs.some(b => a.sourceId === b.sourceId)
      );
      if (sameSource && signals[i].category === signals[j].category) {
        violations.push(
          `Signals "${signals[i].title}" and "${signals[j].title}" are from the same source and category.`
        );
      }
    }
  }

  return {
    gateId: "VG-DEDUP",
    level: "blocking",
    passed: violations.length === 0,
    violations,
  };
};
