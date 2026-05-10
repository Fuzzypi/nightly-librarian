import type { Gate } from "../types.ts";

export const worthMentioningGate: Gate = (brief) => {
  const violations: string[] = [];
  const signalsSection = brief.match(/─── THE 5 SIGNALS ─+\n([\s\S]*?)(?=─── TRY THIS)/)?.[1] ?? "";
  const blocks = signalsSection.split(/(?=^\d+\.\s)/m).filter(b => /^\d+\.\s/.test(b));

  if (blocks.length === 0) {
    violations.push("No signals found in brief.");
  } else {
    for (const block of blocks) {
      const titleMatch = block.match(/^\d+\.\s+(.+)/);
      const title = titleMatch?.[1]?.trim() ?? "(unknown)";
      if (!/BUILDER IMPACT:/.test(block)) {
        violations.push(`Signal "${title}" is missing a BUILDER IMPACT: section.`);
      }
    }
  }

  return {
    gateId: "VG-WORTH",
    level: "blocking",
    passed: violations.length === 0,
    violations,
  };
};
