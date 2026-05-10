import type { Gate } from "../types.ts";

export const sourceRefGate: Gate = (brief) => {
  const violations: string[] = [];
  const signalsSection = brief.match(/─── THE 5 SIGNALS ─+\n([\s\S]*?)(?=─── TRY THIS)/)?.[1] ?? "";
  const blocks = signalsSection.split(/(?=^\d+\.\s)/m).filter(b => /^\d+\.\s/.test(b));

  for (const block of blocks) {
    const titleMatch = block.match(/^\d+\.\s+(.+)/);
    const title = titleMatch?.[1]?.trim() ?? "(unknown)";
    const sourceUrls = block.match(/Source: https?:\/\/\S+/g) ?? [];
    if (sourceUrls.length === 0) {
      violations.push(`Signal "${title}" has no Source: URL in the brief.`);
    }
  }

  return {
    gateId: "VG-SOURCE",
    level: "blocking",
    passed: violations.length === 0,
    violations,
  };
};
