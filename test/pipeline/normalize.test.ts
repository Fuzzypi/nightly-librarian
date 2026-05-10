import { describe, test, expect } from "bun:test";
import { normalizeItems } from "../../src/pipeline/normalize.ts";
import type { RawItem } from "../../src/types.ts";

const makeRawItem = (overrides: Partial<RawItem> = {}): RawItem => ({
  sourceId: "test-source",
  sourceName: "Test Source",
  sourceTier: 1,
  sourceUrl: "https://example.com/test",
  title: "Test Item",
  content: "This is test content about OpenAI and GPT-5.",
  publishedAt: "2026-05-09T10:00:00Z",
  discoveredAt: "2026-05-09T12:00:00Z",
  ...overrides,
});

describe("normalize", () => {
  test("produces CandidateSignal from RawItem", () => {
    const items = normalizeItems([makeRawItem()]);
    expect(items.length).toBe(1);
    expect(items[0].id).toBeTruthy();
    expect(items[0].title).toBe("Test Item");
    expect(items[0].sourceRefs.length).toBe(1);
    expect(items[0].sourceRefs[0].sourceId).toBe("test-source");
  });

  test("extracts entities", () => {
    const items = normalizeItems([makeRawItem({ content: "OpenAI released GPT-5 today." })]);
    expect(items[0].entities).toContain("OpenAI");
  });

  test("generates deterministic ID", () => {
    const a = normalizeItems([makeRawItem()]);
    const b = normalizeItems([makeRawItem()]);
    expect(a[0].id).toBe(b[0].id);
  });

  test("different titles produce different IDs", () => {
    const a = normalizeItems([makeRawItem({ title: "Title A" })]);
    const b = normalizeItems([makeRawItem({ title: "Title B" })]);
    expect(a[0].id).not.toBe(b[0].id);
  });

  test("assigns evidence level based on tier and URL", () => {
    const changelog = normalizeItems([makeRawItem({ sourceUrl: "https://example.com/changelog/v1" })]);
    expect(changelog[0].evidenceLevel).toBe("official_changelog");

    const blog = normalizeItems([makeRawItem({ sourceUrl: "https://example.com/blog/post" })]);
    expect(blog[0].evidenceLevel).toBe("official_blog");

    const tier2 = normalizeItems([makeRawItem({ sourceTier: 2, sourceUrl: "https://hn.com/story" })]);
    expect(tier2[0].evidenceLevel).toBe("single_credible");
  });

  test("guesses category from content", () => {
    const deprecation = normalizeItems([makeRawItem({ content: "This API endpoint is deprecated as of today." })]);
    expect(deprecation[0].category).toBe("deprecation");

    const pricing = normalizeItems([makeRawItem({ content: "New pricing: $0.01 per 1K tokens." })]);
    expect(pricing[0].category).toBe("pricing_change");
  });
});
