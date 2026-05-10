import type { SourceDefinition, RawItem, SourceRegistry } from "../types.ts";
import type { Fetcher } from "../fetchers/interface.ts";
import { rssFetcher } from "../fetchers/rss.ts";
import { hnFetcher } from "../fetchers/hackernews.ts";
import { ghReleasesFetcher } from "../fetchers/github-releases.ts";
import { logger } from "../util/logger.ts";

const fetchers: Record<string, Fetcher> = {
  rss: rssFetcher,
  hackernews: hnFetcher,
  "github-releases": ghReleasesFetcher,
};

export interface FetchResult {
  items: RawItem[];
  sourcesAttempted: number;
  sourcesFetched: number;
  sourcesFailed: string[];
}

export async function fetchAllSources(registry: SourceRegistry): Promise<FetchResult> {
  const enabledSources = registry.sources.filter(s => s.enabled);
  const result: FetchResult = {
    items: [],
    sourcesAttempted: enabledSources.length,
    sourcesFetched: 0,
    sourcesFailed: [],
  };

  for (const source of enabledSources) {
    const fetcher = fetchers[source.fetcherType];
    if (!fetcher) {
      logger.warn("fetch", `No fetcher for type "${source.fetcherType}" (source: ${source.id})`);
      result.sourcesFailed.push(source.id);
      continue;
    }

    try {
      const items = await fetcher.fetch(source, registry.fetchWindowHours);
      logger.info("fetch", `${source.id}: ${items.length} items`);
      result.items.push(...items);
      if (items.length > 0) {
        result.sourcesFetched++;
      }
    } catch (err) {
      logger.error("fetch", `${source.id} failed: ${err instanceof Error ? err.message : String(err)}`);
      result.sourcesFailed.push(source.id);
    }
  }

  logger.info("fetch", `${result.items.length} raw items from ${result.sourcesFetched}/${result.sourcesAttempted} sources`);
  return result;
}
