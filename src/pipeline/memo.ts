import type { Selection, PipelineRun, GateReport, SponsorSlot, ScoredCandidate } from "../types.ts";
import { formatDate } from "../util/date.ts";

export function generateMemo(
  selection: Selection,
  runMeta: Partial<PipelineRun>,
  gateReport: GateReport | null,
  allScored: ScoredCandidate[]
): string {
  const date = formatDate(new Date());
  const lines: string[] = [];

  lines.push(`# NIGHTLY LIBRARIAN — PRIVATE MEMO`);
  lines.push(`# ${date}`);
  lines.push(`# Run: ${runMeta.runId ?? "unknown"}`);
  lines.push(``);

  lines.push(`## SOURCE HEALTH`);
  lines.push(``);
  lines.push(`Sources attempted: ${runMeta.sourcesAttempted ?? 0}`);
  lines.push(`Sources fetched:   ${runMeta.sourcesFetched ?? 0}`);
  lines.push(`Sources failed:    ${runMeta.sourcesFailed?.length ?? 0}`);
  lines.push(``);
  if (runMeta.sourcesFailed && runMeta.sourcesFailed.length > 0) {
    lines.push(`Failed sources:`);
    for (const id of runMeta.sourcesFailed) {
      lines.push(`- ${id}`);
    }
    lines.push(``);
  }

  lines.push(`## RAW SIGNAL INVENTORY`);
  lines.push(``);
  lines.push(`Total raw items:    ${runMeta.rawItemCount ?? 0}`);
  lines.push(`After dedup:        ${runMeta.candidateCount ?? 0} (${runMeta.dedupMerges ?? 0} merges)`);
  const worthCount = allScored.filter(c => c.worthMentioning).length;
  lines.push(`Worth mentioning:   ${worthCount}`);
  lines.push(`Selected for brief: ${selection.signals.length + (selection.tryThis ? 1 : 0)}`);
  lines.push(``);

  lines.push(`## SELECTED SIGNALS`);
  lines.push(``);
  for (let i = 0; i < selection.signals.length; i++) {
    const s = selection.signals[i];
    lines.push(`### Signal ${i + 1}: ${s.title}`);
    lines.push(``);
    lines.push(`Score: ${s.normalizedScore}/100`);
    lines.push(`Category: ${s.category}`);
    lines.push(`Evidence: ${s.evidenceLevel}`);
    lines.push(`Sources: ${s.sourceRefs.map(r => `${r.sourceName} (T${r.sourceTier})`).join(", ")}`);
    lines.push(``);
    lines.push(`Justifications:`);
    for (const [key, val] of Object.entries(s.justifications)) {
      lines.push(`- ${key}: ${val}`);
    }
    lines.push(``);
  }

  lines.push(`## TRY THIS`);
  lines.push(``);
  if (selection.tryThis) {
    lines.push(`${selection.tryThis.title}`);
    lines.push(`Score: ${selection.tryThis.normalizedScore}/100`);
    lines.push(`Reason selected: ${selection.tryThis.selectionReason}`);
  } else {
    lines.push(`(none selected)`);
  }
  lines.push(``);

  lines.push(`## IGNORE PILE (private — not in public brief)`);
  lines.push(``);
  if (selection.memoIgnore.length > 0) {
    for (const item of selection.memoIgnore) {
      lines.push(`### ${item.title}`);
      lines.push(`Score: ${item.normalizedScore}/100`);
      lines.push(`Why ignored: ${item.selectionReason}`);
      lines.push(``);
    }
  } else {
    lines.push(`(no items in ignore pile)`);
    lines.push(``);
  }

  lines.push(`## DROPPED CANDIDATES`);
  lines.push(``);
  if (selection.dropped.length > 0) {
    for (const d of selection.dropped) {
      lines.push(`- ${d.title} (${d.normalizedScore}/100, ${d.category})`);
    }
  } else {
    lines.push(`(none)`);
  }
  lines.push(``);

  lines.push(`## SCORING DISTRIBUTION`);
  lines.push(``);
  lines.push(generateHistogram(allScored));
  lines.push(``);

  lines.push(`## GATE RESULTS`);
  lines.push(``);
  if (gateReport) {
    for (const r of gateReport.results) {
      const status = r.passed ? "PASS" : "FAIL";
      lines.push(`[${status}] ${r.gateId}: ${r.violations.length} violations`);
      for (const v of r.violations) {
        lines.push(`  - ${v}`);
      }
    }
  } else {
    lines.push(`(gates not yet run)`);
  }
  lines.push(``);

  lines.push(`## SPONSOR`);
  lines.push(``);
  if (runMeta.sponsor) {
    lines.push(`${runMeta.sponsor.name} — ${runMeta.sponsor.tagline}`);
  } else {
    lines.push(`(none)`);
  }

  return lines.join("\n");
}

function generateHistogram(scored: ScoredCandidate[]): string {
  const buckets: Record<string, number> = {
    "0-19": 0, "20-39": 0, "40-59": 0, "60-79": 0, "80-100": 0,
  };
  for (const c of scored) {
    const s = c.normalizedScore;
    if (s < 20) buckets["0-19"]++;
    else if (s < 40) buckets["20-39"]++;
    else if (s < 60) buckets["40-59"]++;
    else if (s < 80) buckets["60-79"]++;
    else buckets["80-100"]++;
  }

  const lines: string[] = [];
  const max = Math.max(...Object.values(buckets), 1);
  for (const [range, count] of Object.entries(buckets)) {
    const bar = "█".repeat(Math.round((count / max) * 20));
    lines.push(`${range.padStart(6)}: ${bar} (${count})`);
  }
  return lines.join("\n");
}
