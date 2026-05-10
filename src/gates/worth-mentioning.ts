import type { Gate } from "../types.ts";

export const worthMentioningGate: Gate = (brief) => {
  const violations: string[] = [];
  const signalsSection = brief.match(/─── THE 5 SIGNALS ─+\n([\s\S]*?)(?=─── TRY THIS)/)?.[1] ?? "";
  const signalCount = (signalsSection.match(/^\d+\./gm) ?? []).length;
  const impactCount = (signalsSection.match(/BUILDER IMPACT:/g) ?? []).length;

  if (signalCount === 0) {
    violations.push("No signals found in brief.");
  } else if (impactCount < signalCount) {
    violations.push(`Brief has ${signalCount} signals but only ${impactCount} BUILDER IMPACT sections.`);
  }

  return {
    gateId: "VG-WORTH",
    level: "blocking",
    passed: violations.length === 0,
    violations,
  };
};
