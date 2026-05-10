import type { Gate } from "../types.ts";

export const signalCountGate: Gate = (brief) => {
  const violations: string[] = [];
  const signalsSection = brief.match(/─── THE 5 SIGNALS ─+\n([\s\S]*?)(?=─── TRY THIS)/)?.[1] ?? "";
  const blocks = signalsSection.split(/(?=^\d+\.\s)/m).filter(b => /^\d+\.\s/.test(b));

  if (blocks.length !== 5) {
    violations.push(`Brief has ${blocks.length} signals, expected exactly 5.`);
  }

  return {
    gateId: "VG-COUNT",
    level: "blocking",
    passed: violations.length === 0,
    violations,
  };
};
