import type { Gate } from "../types.ts";

export const sponsorPositionGate: Gate = (brief, _selection, _editorial, runMeta) => {
  const violations: string[] = [];
  const sponsorName = runMeta.sponsor?.name;
  const sponsorTagline = runMeta.sponsor?.tagline;

  if (!sponsorName) return { gateId: "VG-SPONSOR-POS", level: "blocking", passed: true, violations: [] };

  const signalHeaderIdx = brief.indexOf("THE 5 SIGNALS");
  if (signalHeaderIdx === -1) {
    return { gateId: "VG-SPONSOR-POS", level: "blocking", passed: true, violations: [] };
  }

  const afterSignals = brief.slice(signalHeaderIdx);
  if (afterSignals.toLowerCase().includes(sponsorName.toLowerCase())) {
    const isInSourceUrl = afterSignals.split("\n").some(line =>
      line.trim().startsWith("Source:") && line.toLowerCase().includes(sponsorName.toLowerCase())
    );
    if (!isInSourceUrl) {
      violations.push(`Sponsor name "${sponsorName}" appears after THE 5 SIGNALS header.`);
    }
  }
  if (sponsorTagline && afterSignals.toLowerCase().includes(sponsorTagline.toLowerCase())) {
    violations.push(`Sponsor tagline appears after THE 5 SIGNALS header.`);
  }

  return {
    gateId: "VG-SPONSOR-POS",
    level: "blocking",
    passed: violations.length === 0,
    violations,
  };
};
