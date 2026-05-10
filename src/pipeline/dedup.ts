import type { CandidateSignal } from "../types.ts";
import { jaccardSimilarity, levenshteinRatio } from "../util/text.ts";
import { sha256 } from "../util/hash.ts";

export interface DedupResult {
  unique: CandidateSignal[];
  mergeCount: number;
}

export function deduplicateCandidates(candidates: CandidateSignal[]): DedupResult {
  if (candidates.length === 0) return { unique: [], mergeCount: 0 };

  const sorted = [...candidates].sort((a, b) => {
    const tierA = Math.min(...a.sourceRefs.map(r => r.sourceTier));
    const tierB = Math.min(...b.sourceRefs.map(r => r.sourceTier));
    return tierA - tierB;
  });

  const merged: boolean[] = new Array(sorted.length).fill(false);
  let mergeCount = 0;

  for (let i = 0; i < sorted.length; i++) {
    if (merged[i]) continue;
    for (let j = i + 1; j < sorted.length; j++) {
      if (merged[j]) continue;

      const a = sorted[i];
      const b = sorted[j];

      if (a.id === b.id) {
        mergeCandidates(a, b);
        merged[j] = true;
        mergeCount++;
        continue;
      }

      const entitySim = jaccardSimilarity(a.entities, b.entities);
      if (entitySim >= 0.6 && a.category === b.category) {
        mergeCandidates(a, b);
        merged[j] = true;
        mergeCount++;
        continue;
      }

      const titleSim = levenshteinRatio(a.title, b.title);
      if (titleSim > 0.8 && a.category === b.category) {
        mergeCandidates(a, b);
        merged[j] = true;
        mergeCount++;
      }
    }
  }

  const unique = sorted.filter((_, i) => !merged[i]);

  for (const c of unique) {
    if (c.sourceRefs.length >= 2) {
      const publishers = new Set(c.sourceRefs.map(r => r.sourceId));
      if (publishers.size >= 2 && c.evidenceLevel !== "official_changelog") {
        c.evidenceLevel = "multi_source";
      }
    }
    if (c.dedupGroup === null && c.sourceRefs.length >= 2) {
      const sortedEntities = [...c.entities].sort().join("|");
      c.dedupGroup = sha256(sortedEntities);
    }
  }

  return { unique, mergeCount };
}

function mergeCandidates(primary: CandidateSignal, secondary: CandidateSignal): void {
  const existingSourceIds = new Set(primary.sourceRefs.map(r => r.sourceId));
  for (const ref of secondary.sourceRefs) {
    if (!existingSourceIds.has(ref.sourceId)) {
      primary.sourceRefs.push(ref);
    }
  }

  for (const claim of secondary.rawClaims) {
    if (!primary.rawClaims.includes(claim)) {
      primary.rawClaims.push(claim);
    }
  }

  for (const entity of secondary.entities) {
    if (!primary.entities.includes(entity)) {
      primary.entities.push(entity);
    }
  }

  if (!primary.summary && secondary.summary) {
    primary.summary = secondary.summary;
  }
}
