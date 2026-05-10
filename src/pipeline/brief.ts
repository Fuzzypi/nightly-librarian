import type { Selection, SponsorSlot } from "../types.ts";
import { formatDate } from "../util/date.ts";

export function generateBrief(
  selection: Selection,
  sponsor: SponsorSlot,
  issueNumber: number = 0
): string {
  const date = formatDate(new Date());
  const lines: string[] = [];

  lines.push(`═══════════════════════════════════════════`);
  lines.push(`THE NIGHTLY LIBRARIAN`);
  lines.push(`${date} — Issue #${issueNumber}`);
  lines.push(`═══════════════════════════════════════════`);
  lines.push(``);
  lines.push(`Brought to you by ${sponsor.name} — ${sponsor.tagline}`);
  lines.push(``);
  lines.push(`─── THE 5 SIGNALS ─────────────────────────`);
  lines.push(``);

  for (let i = 0; i < selection.signals.length; i++) {
    const s = selection.signals[i];
    const context = s.selectionReason.includes("[CONTEXT]") ? " [CONTEXT]" : "";
    lines.push(`${i + 1}. ${s.title}${context}`);
    lines.push(`   ${s.summary || "No summary available."}`);
    lines.push(``);
    lines.push(`   BUILDER IMPACT: ${s.justifications.soloDevRelevance}`);
    lines.push(``);
    lines.push(`   Evidence: ${s.evidenceLevel}`);
    lines.push(``);
    lines.push(`   Source: ${s.sourceRefs[0]?.url ?? "(no source)"}`);
    if (s.sourceRefs.length > 1) {
      for (const ref of s.sourceRefs.slice(1)) {
        lines.push(`   Source: ${ref.url}`);
      }
    }
    lines.push(``);
  }

  lines.push(`─── TRY THIS ───────────────────────────────`);
  lines.push(``);
  if (selection.tryThis) {
    lines.push(`${selection.tryThis.title}`);
    lines.push(``);
    lines.push(generateTryThisBody(selection.tryThis));
    lines.push(``);
    lines.push(`Time: 30-60 minutes`);
    lines.push(``);
    lines.push(`Source: ${selection.tryThis.sourceRefs[0]?.url ?? "(no source)"}`);
  } else {
    lines.push(`No standout recommendation today.`);
  }
  lines.push(``);

  lines.push(`─── LIBRARIAN'S VERDICT ────────────────────`);
  lines.push(``);
  lines.push(generateVerdict(selection));
  lines.push(``);

  lines.push(`═══════════════════════════════════════════`);
  lines.push(`The Nightly Librarian — thenightlylibrarian.com`);
  lines.push(`Unsubscribe | Archive`);
  lines.push(`═══════════════════════════════════════════`);

  return lines.join("\n");
}

function generateTryThisBody(candidate: Selection["tryThis"]): string {
  if (!candidate) return "";
  const parts: string[] = [];
  parts.push(candidate.summary || candidate.title);
  if (candidate.justifications.soloDevRelevance) {
    parts.push(candidate.justifications.soloDevRelevance);
  }
  return parts.join(" ");
}

function generateVerdict(selection: Selection): string {
  const categories = new Set(selection.signals.map(s => s.category));
  const parts: string[] = [];

  if (categories.has("deprecation") || categories.has("security_issue")) {
    parts.push("Action items today: check if any deprecations or security issues affect your stack.");
  } else if (categories.has("tool_release") || categories.has("api_change")) {
    parts.push("A day of tooling updates. Review the changes and test any that touch your workflow.");
  } else if (categories.has("model_release")) {
    parts.push("New model capabilities dropped today. Evaluate before adopting — benchmarks are not production.");
  } else {
    parts.push("A quieter day in AI. Use the breathing room to ship, not to scroll.");
  }

  if (selection.signals.some(s => s.scores.hypeRisk >= 7)) {
    parts.push("Hype levels are elevated on at least one story — read the source, not the headlines.");
  }

  if (categories.size >= 4) {
    parts.push("Broad signal spread today across multiple categories.");
  }

  return parts.join(" ");
}
