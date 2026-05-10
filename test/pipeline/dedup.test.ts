import { describe, test, expect } from "bun:test";
import { deduplicateCandidates } from "../../src/pipeline/dedup.ts";
import type { CandidateSignal } from "../../src/types.ts";

const makeCandidate = (overrides: Partial<CandidateSignal> = {}): CandidateSignal => ({
  id: "test-" + Math.random().toString(36).slice(2),
  title: "Test Signal",
  summary: "A test signal.",
  category: "model_release",
  evidenceLevel: "official_blog",
  sourceRefs: [{ sourceId: "src-1", sourceName: "Source 1", sourceTier: 1, url: "https://example.com" }],
  entities: ["OpenAI", "GPT-5"],
  publishedAt: "2026-05-09T10:00:00Z",
  discoveredAt: "2026-05-09T12:00:00Z",
  rawClaims: [],
  dedupGroup: null,
  ...overrides,
});

describe("dedup", () => {
  test("no merges for unique candidates", () => {
    const candidates = [
      makeCandidate({ entities: ["OpenAI"], category: "model_release" }),
      makeCandidate({ entities: ["Anthropic"], category: "tool_release" }),
    ];
    const { unique, mergeCount } = deduplicateCandidates(candidates);
    expect(unique.length).toBe(2);
    expect(mergeCount).toBe(0);
  });

  test("merges candidates with high entity overlap and same category", () => {
    const candidates = [
      makeCandidate({ entities: ["OpenAI", "GPT-5", "Claude"], category: "model_release", sourceRefs: [{ sourceId: "src-1", sourceName: "Source 1", sourceTier: 1, url: "https://a.com" }] }),
      makeCandidate({ entities: ["OpenAI", "GPT-5"], category: "model_release", sourceRefs: [{ sourceId: "src-2", sourceName: "Source 2", sourceTier: 2, url: "https://b.com" }] }),
    ];
    const { unique, mergeCount } = deduplicateCandidates(candidates);
    expect(unique.length).toBe(1);
    expect(mergeCount).toBe(1);
    expect(unique[0].sourceRefs.length).toBe(2);
  });

  test("does not merge different categories", () => {
    const candidates = [
      makeCandidate({ entities: ["OpenAI", "GPT-5"], category: "model_release" }),
      makeCandidate({ entities: ["OpenAI", "GPT-5"], category: "pricing_change" }),
    ];
    const { unique, mergeCount } = deduplicateCandidates(candidates);
    expect(unique.length).toBe(2);
    expect(mergeCount).toBe(0);
  });

  test("upgrades evidence level to multi_source on merge", () => {
    const candidates = [
      makeCandidate({ entities: ["OpenAI", "GPT-5"], evidenceLevel: "official_blog", sourceRefs: [{ sourceId: "src-1", sourceName: "S1", sourceTier: 1, url: "https://a.com" }] }),
      makeCandidate({ entities: ["OpenAI", "GPT-5"], evidenceLevel: "single_credible", sourceRefs: [{ sourceId: "src-2", sourceName: "S2", sourceTier: 2, url: "https://b.com" }] }),
    ];
    const { unique } = deduplicateCandidates(candidates);
    expect(unique[0].evidenceLevel).toBe("multi_source");
  });

  test("keeps higher-tier source as primary", () => {
    const candidates = [
      makeCandidate({ entities: ["OpenAI"], sourceRefs: [{ sourceId: "tier2", sourceName: "T2", sourceTier: 2, url: "https://b.com" }] }),
      makeCandidate({ entities: ["OpenAI"], sourceRefs: [{ sourceId: "tier1", sourceName: "T1", sourceTier: 1, url: "https://a.com" }] }),
    ];
    const { unique } = deduplicateCandidates(candidates);
    expect(unique[0].sourceRefs[0].sourceTier).toBe(1);
  });

  test("handles empty input", () => {
    const { unique, mergeCount } = deduplicateCandidates([]);
    expect(unique.length).toBe(0);
    expect(mergeCount).toBe(0);
  });
});
