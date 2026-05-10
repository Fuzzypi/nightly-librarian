import { describe, test, expect } from "bun:test";
import { scoreCandidates } from "../../src/pipeline/score.ts";
import { loadScoring, loadEditorial } from "../../src/config.ts";
import type { CandidateSignal } from "../../src/types.ts";

const scoring = loadScoring();
const editorial = loadEditorial();

const makeCandidate = (overrides: Partial<CandidateSignal> = {}): CandidateSignal => ({
  id: "test-score-1",
  title: "Test Signal",
  summary: "A test signal.",
  category: "model_release",
  evidenceLevel: "official_blog",
  sourceRefs: [{ sourceId: "src-1", sourceName: "Source 1", sourceTier: 1, url: "https://example.com" }],
  entities: ["OpenAI"],
  publishedAt: "2026-05-09T10:00:00Z",
  discoveredAt: "2026-05-09T12:00:00Z",
  rawClaims: [],
  dedupGroup: null,
  ...overrides,
});

describe("scoring", () => {
  test("produces deterministic scores for same input", () => {
    const candidate = makeCandidate();
    const a = scoreCandidates([candidate], scoring, editorial);
    const b = scoreCandidates([candidate], scoring, editorial);
    expect(a[0].normalizedScore).toBe(b[0].normalizedScore);
    expect(a[0].scores).toEqual(b[0].scores);
  });

  test("tool_release scores higher on actionability than benchmark", () => {
    const tool = scoreCandidates([makeCandidate({ category: "tool_release" })], scoring, editorial);
    const bench = scoreCandidates([makeCandidate({ category: "benchmark" })], scoring, editorial);
    expect(tool[0].scores.actionability).toBeGreaterThan(bench[0].scores.actionability);
  });

  test("tier 1 scores higher on credibility than tier 2", () => {
    const t1 = scoreCandidates([makeCandidate()], scoring, editorial);
    const t2 = scoreCandidates([makeCandidate({
      sourceRefs: [{ sourceId: "src-2", sourceName: "Source 2", sourceTier: 2, url: "https://example.com" }],
    })], scoring, editorial);
    expect(t1[0].scores.sourceCredibility).toBeGreaterThan(t2[0].scores.sourceCredibility);
  });

  test("deprecation scores higher on urgency", () => {
    const dep = scoreCandidates([makeCandidate({ category: "deprecation" })], scoring, editorial);
    const tool = scoreCandidates([makeCandidate({ category: "tool_release" })], scoring, editorial);
    expect(dep[0].scores.urgency).toBeGreaterThan(tool[0].scores.urgency);
  });

  test("worthMentioning is true when score >= conditionalCandidate threshold", () => {
    const scored = scoreCandidates([makeCandidate()], scoring, editorial);
    if (scored[0].normalizedScore >= scoring.thresholds.conditionalCandidate) {
      expect(scored[0].worthMentioning).toBe(true);
    } else {
      expect(scored[0].worthMentioning).toBe(false);
    }
  });

  test("generates justifications for all dimensions", () => {
    const scored = scoreCandidates([makeCandidate()], scoring, editorial);
    expect(scored[0].justifications.worthMentioningReason).toBeTruthy();
    expect(scored[0].justifications.soloDevRelevance).toBeTruthy();
    expect(scored[0].justifications.soloDevUsefulness).toBeTruthy();
  });

  test("solo dev tools boost soloDevUsefulness", () => {
    const withTool = scoreCandidates([makeCandidate({
      title: "Cursor gets new feature",
      summary: "Cursor AI editor update",
    })], scoring, editorial);
    const without = scoreCandidates([makeCandidate({
      title: "Enterprise dashboard update",
      summary: "New enterprise admin console",
    })], scoring, editorial);
    expect(withTool[0].scores.soloDevUsefulness).toBeGreaterThan(without[0].scores.soloDevUsefulness);
  });

  test("hype content increases hypeRisk score", () => {
    const hyped = scoreCandidates([makeCandidate({
      summary: "This changes everything and is mind-blowing",
    })], scoring, editorial);
    const clean = scoreCandidates([makeCandidate({
      summary: "Version 2.0 released with bug fixes",
    })], scoring, editorial);
    expect(hyped[0].scores.hypeRisk).toBeGreaterThan(clean[0].scores.hypeRisk);
  });
});
