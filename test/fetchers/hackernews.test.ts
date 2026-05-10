import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { parseHNItems } from "../../src/fetchers/hackernews.ts";
import type { SourceDefinition } from "../../src/types.ts";

const fixtureData = JSON.parse(readFileSync(join(import.meta.dir, "..", "fixtures", "hn-sample.json"), "utf-8"));
const source: SourceDefinition = {
  id: "test-hn",
  name: "Test HN",
  tier: 2,
  fetcherType: "hackernews",
  url: "https://hn.algolia.com/api/v1/search",
  category: "workflow_pattern",
  enabled: true,
};

describe("HN fetcher", () => {
  test("filters by minimum points", () => {
    const items = parseHNItems(fixtureData, source, 50);
    expect(items.length).toBe(3);
    const titles = items.map(i => i.title);
    expect(titles).not.toContain("Low-quality post about AI");
  });

  test("uses HN URL for items without url", () => {
    const items = parseHNItems(fixtureData, source, 5);
    const lowQuality = items.find(i => i.title === "Low-quality post about AI");
    expect(lowQuality?.sourceUrl).toContain("news.ycombinator.com");
  });

  test("sets correct source metadata", () => {
    const items = parseHNItems(fixtureData, source, 50);
    expect(items[0].sourceId).toBe("test-hn");
    expect(items[0].sourceTier).toBe(2);
  });

  test("preserves objectID as guid", () => {
    const items = parseHNItems(fixtureData, source, 50);
    expect(items[0].guid).toBe("40001");
  });
});
