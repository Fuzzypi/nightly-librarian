import type { ScoredCandidate, SelectedCandidate, Selection, SelectionRole } from "../types.ts";

export function selectCandidates(scored: ScoredCandidate[]): Selection {
  const worthMentioning = scored.filter(c => c.worthMentioning);
  const notWorth = scored.filter(c => !c.worthMentioning);

  const sorted = [...worthMentioning].sort((a, b) => {
    if (b.normalizedScore !== a.normalizedScore) return b.normalizedScore - a.normalizedScore;
    if (b.scores.actionability !== a.scores.actionability) return b.scores.actionability - a.scores.actionability;
    if (a.scores.hypeRisk !== b.scores.hypeRisk) return a.scores.hypeRisk - b.scores.hypeRisk;
    const tierA = Math.min(...a.sourceRefs.map(r => r.sourceTier));
    const tierB = Math.min(...b.sourceRefs.map(r => r.sourceTier));
    return tierA - tierB;
  });

  const signals: SelectedCandidate[] = [];
  const usedIds = new Set<string>();

  for (const candidate of sorted) {
    if (signals.length >= 5) break;
    if (usedIds.has(candidate.id)) continue;
    const role = `signal_${signals.length + 1}` as SelectionRole;
    signals.push({
      ...candidate,
      selectedAs: role,
      selectionReason: `Rank #${signals.length + 1} by normalized score (${candidate.normalizedScore}).`,
    });
    usedIds.add(candidate.id);
  }

  while (signals.length < 5 && notWorth.length > 0) {
    const filler = notWorth.shift()!;
    if (usedIds.has(filler.id)) continue;
    const role = `signal_${signals.length + 1}` as SelectionRole;
    signals.push({
      ...filler,
      selectedAs: role,
      selectionReason: `[CONTEXT] Filler signal — below threshold (${filler.normalizedScore}).`,
      worthMentioning: true,
    });
    usedIds.add(filler.id);
  }

  let tryThis: SelectedCandidate | null = null;
  const tryThisCandidates = sorted.filter(c => !usedIds.has(c.id) && c.scores.actionability >= 6);
  if (tryThisCandidates.length > 0) {
    const best = tryThisCandidates[0];
    tryThis = {
      ...best,
      selectedAs: "try_this",
      selectionReason: `Highest actionability (${best.scores.actionability}) among remaining candidates.`,
    };
    usedIds.add(best.id);
  } else if (sorted.length > 5) {
    const fallback = sorted.find(c => !usedIds.has(c.id));
    if (fallback) {
      tryThis = {
        ...fallback,
        selectedAs: "try_this",
        selectionReason: `Next highest-scoring candidate (${fallback.normalizedScore}).`,
      };
      usedIds.add(fallback.id);
    }
  }

  const memoIgnore: SelectedCandidate[] = [];
  const highHype = sorted
    .filter(c => !usedIds.has(c.id) && c.scores.hypeRisk >= 6)
    .slice(0, 3);
  for (const c of highHype) {
    memoIgnore.push({
      ...c,
      selectedAs: "memo_ignore",
      selectionReason: `High hype risk (${c.scores.hypeRisk}) — included in private memo only.`,
    });
    usedIds.add(c.id);
  }

  const dropped = scored.filter(c => !usedIds.has(c.id));

  return { signals, tryThis, memoIgnore, dropped };
}
