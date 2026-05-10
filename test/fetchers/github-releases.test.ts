import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { parseGHReleases } from "../../src/fetchers/github-releases.ts";
import type { SourceDefinition } from "../../src/types.ts";

const fixtureData = JSON.parse(readFileSync(join(import.meta.dir, "..", "fixtures", "gh-releases-sample.json"), "utf-8"));
const source: SourceDefinition = {
  id: "test-gh",
  name: "Test GH",
  tier: 1,
  fetcherType: "github-releases",
  url: "https://api.github.com/repos/test/test/releases",
  category: "tool_release",
  enabled: true,
};

describe("GitHub releases fetcher", () => {
  test("filters by time window", () => {
    const ref = new Date("2026-05-09T12:00:00Z");
    const items = parseGHReleases(fixtureData, source, 28, ref);
    expect(items.length).toBe(1);
    expect(items[0].title).toBe("Ollama v0.8.0: Vision Model Support");
  });

  test("excludes draft releases", () => {
    const ref = new Date("2026-05-09T14:00:00Z");
    const items = parseGHReleases(fixtureData, source, 28 * 24, ref);
    const titles = items.map(i => i.title);
    expect(titles).not.toContain("Draft Release");
  });

  test("includes prerelease when in window", () => {
    const ref = new Date("2026-05-08T12:00:00Z");
    const items = parseGHReleases(fixtureData, source, 48, ref);
    const titles = items.map(i => i.title);
    expect(titles).toContain("v0.8.0 Release Candidate 1");
  });

  test("strips HTML from body", () => {
    const ref = new Date("2026-05-09T12:00:00Z");
    const items = parseGHReleases(fixtureData, source, 28, ref);
    expect(items[0].content).not.toContain("<");
  });
});
