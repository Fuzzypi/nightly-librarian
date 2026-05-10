import type { Gate } from "../types.ts";

export const evidenceLevelGate: Gate = (brief) => {
  const violations: string[] = [];
  const signalsSection = brief.match(/─── THE 5 SIGNALS ─+\n([\s\S]*?)(?=─── TRY THIS)/)?.[1] ?? "";
  const blocks = signalsSection.split(/(?=^\d+\.\s)/m).filter(b => /^\d+\.\s/.test(b));

  for (const block of blocks) {
    const titleMatch = block.match(/^\d+\.\s+(.+)/);
    const title = titleMatch?.[1]?.trim() ?? "(unknown)";
    const evidenceMatch = block.match(/Evidence: (\S+)/);
    if (!evidenceMatch) {
      violations.push(`Signal "${title}" has no Evidence: level in the brief.`);
    } else if (evidenceMatch[1] === "rumor") {
      violations.push(`Signal "${title}" has evidence level "rumor" — not suitable for public signals.`);
    }
  }

  return {
    gateId: "VG-EVIDENCE",
    level: "blocking",
    passed: violations.length === 0,
    violations,
  };
};
