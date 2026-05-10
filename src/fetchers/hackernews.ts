import type { Fetcher } from "./interface.ts";
import type { SourceDefinition, RawItem } from "../types.ts";


interface HNHit {
  objectID: string;
  title: string;
  url?: string;
  story_text?: string;
  points: number;
  created_at: string;
  num_comments: number;
}

interface HNResponse {
  hits: HNHit[];
}

export function parseHNItems(data: HNResponse, source: SourceDefinition, minPoints: number): RawItem[] {
  const now = new Date().toISOString();
  return data.hits
    .filter(hit => hit.points >= minPoints)
    .map(hit => ({
      sourceId: source.id,
      sourceName: source.name,
      sourceTier: source.tier,
      sourceUrl: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      title: hit.title,
      content: hit.story_text || `${hit.title} (${hit.points} points, ${hit.num_comments} comments)`,
      publishedAt: new Date(hit.created_at).toISOString(),
      discoveredAt: now,
      guid: hit.objectID,
    }));
}

export const hnFetcher: Fetcher = {
  type: "hackernews",
  async fetch(source, windowHours) {
      const opts = source.fetchOptions ?? {};
      const minPoints = (opts.minPoints as number) ?? 50;
      const query = (opts.query as string) ?? "AI";
      const tags = (opts.tags as string) ?? "story";
      const hitsPerPage = (opts.hitsPerPage as number) ?? 30;

      const cutoffUnix = Math.floor((Date.now() - windowHours * 3600 * 1000) / 1000);
      const params = new URLSearchParams({
        query,
        tags,
        hitsPerPage: String(hitsPerPage),
        numericFilters: `created_at_i>${cutoffUnix}`,
      });

      const response = await fetch(`${source.url}?${params}`, {
        headers: { "User-Agent": "NightlyLibrarian/1.0" },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from HN API`);
      }
      const data: HNResponse = await response.json();
      return parseHNItems(data, source, minPoints);
  },
};
