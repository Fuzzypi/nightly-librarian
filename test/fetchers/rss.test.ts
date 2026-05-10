import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { parseRSSItems } from "../../src/fetchers/rss.ts";
import type { SourceDefinition } from "../../src/types.ts";

const fixtureXml = readFileSync(join(import.meta.dir, "..", "fixtures", "rss-sample.xml"), "utf-8");
const source: SourceDefinition = {
  id: "test-rss",
  name: "Test RSS",
  tier: 1,
  fetcherType: "rss",
  url: "https://example.com/rss",
  category: "model_release",
  enabled: true,
};

describe("RSS fetcher", () => {
  test("parses RSS items within window", () => {
    const ref = new Date("2026-05-09T12:00:00Z");
    const items = parseRSSItems(fixtureXml, source, 28, ref);
    expect(items.length).toBe(2);
    expect(items[0].title).toBe("GPT-5 Released with Enhanced Reasoning");
    expect(items[1].title).toBe("Claude Code Gets Multi-File Editing");
  });

  test("filters items outside window", () => {
    const ref = new Date("2026-05-09T12:00:00Z");
    const items = parseRSSItems(fixtureXml, source, 28, ref);
    const titles = items.map(i => i.title);
    expect(titles).not.toContain("Old Story Outside Window");
  });

  test("sets correct source metadata", () => {
    const ref = new Date("2026-05-09T12:00:00Z");
    const items = parseRSSItems(fixtureXml, source, 28, ref);
    expect(items[0].sourceId).toBe("test-rss");
    expect(items[0].sourceName).toBe("Test RSS");
    expect(items[0].sourceTier).toBe(1);
  });

  test("strips HTML from content", () => {
    const ref = new Date("2026-05-09T12:00:00Z");
    const items = parseRSSItems(fixtureXml, source, 28, ref);
    expect(items[0].content).not.toContain("<");
  });

  test("returns empty array for invalid XML", () => {
    const items = parseRSSItems("not xml at all", source, 28);
    expect(items).toEqual([]);
  });
});
