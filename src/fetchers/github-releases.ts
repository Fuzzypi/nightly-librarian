import type { Fetcher } from "./interface.ts";
import type { SourceDefinition, RawItem } from "../types.ts";
import { isWithinWindow } from "../util/date.ts";
import { stripHtml } from "../util/text.ts";


interface GHRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
}

export function parseGHReleases(data: GHRelease[], source: SourceDefinition, windowHours: number, referenceTime?: Date): RawItem[] {
  const now = new Date().toISOString();
  return data
    .filter(r => !r.draft)
    .filter(r => isWithinWindow(r.published_at, windowHours, referenceTime))
    .map(r => ({
      sourceId: source.id,
      sourceName: source.name,
      sourceTier: source.tier,
      sourceUrl: r.html_url,
      title: r.name || r.tag_name,
      content: stripHtml(r.body || ""),
      publishedAt: new Date(r.published_at).toISOString(),
      discoveredAt: now,
      guid: String(r.id),
    }));
}

export const ghReleasesFetcher: Fetcher = {
  type: "github-releases",
  async fetch(source, windowHours) {
    const headers: Record<string, string> = {
      "User-Agent": "NightlyLibrarian/1.0",
      Accept: "application/vnd.github.v3+json",
    };
    const token = process.env.GITHUB_TOKEN;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(source.url, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${source.id}`);
    }
    const data: GHRelease[] = await response.json();
    return parseGHReleases(data, source, windowHours);
  },
};
