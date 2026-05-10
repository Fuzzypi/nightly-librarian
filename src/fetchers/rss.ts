import { XMLParser } from "fast-xml-parser";
import type { Fetcher } from "./interface.ts";
import type { SourceDefinition, RawItem } from "../types.ts";
import { isWithinWindow } from "../util/date.ts";
import { stripHtml } from "../util/text.ts";


const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

interface RSSChannel {
  item?: RSSItem | RSSItem[];
}

interface RSSItem {
  title?: string;
  link?: string;
  description?: string;
  "content:encoded"?: string;
  pubDate?: string;
  guid?: string | { "#text": string };
}

interface AtomEntry {
  title?: string | { "#text": string };
  link?: string | { "@_href": string } | Array<{ "@_href": string }>;
  summary?: string;
  content?: string | { "#text": string };
  published?: string;
  updated?: string;
  id?: string;
}

function resolveAtomLink(link: AtomEntry["link"]): string {
  if (!link) return "";
  if (typeof link === "string") return link;
  if (Array.isArray(link)) return link[0]?.["@_href"] ?? "";
  return link["@_href"] ?? "";
}

function resolveText(val: string | { "#text": string } | undefined): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  return val["#text"] ?? "";
}

export function parseRSSItems(xml: string, source: SourceDefinition, windowHours: number, referenceTime?: Date): RawItem[] {
  const parsed = parser.parse(xml);
  const now = new Date().toISOString();
  const items: RawItem[] = [];

  if (parsed.rss?.channel) {
    const channel: RSSChannel = parsed.rss.channel;
    const rawItems = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];
    for (const item of rawItems) {
      const pubDate = item.pubDate ? new Date(item.pubDate).toISOString() : now;
      if (!isWithinWindow(pubDate, windowHours, referenceTime)) continue;
      const guidVal = typeof item.guid === "object" ? item.guid["#text"] : item.guid;
      items.push({
        sourceId: source.id,
        sourceName: source.name,
        sourceTier: source.tier,
        sourceUrl: item.link ?? "",
        title: item.title ?? "(no title)",
        content: stripHtml(item["content:encoded"] ?? item.description ?? ""),
        publishedAt: pubDate,
        discoveredAt: now,
        guid: guidVal ?? undefined,
      });
    }
  } else if (parsed.feed?.entry) {
    const entries: AtomEntry[] = Array.isArray(parsed.feed.entry) ? parsed.feed.entry : [parsed.feed.entry];
    for (const entry of entries) {
      const pubDate = entry.published ?? entry.updated ?? now;
      const isoDate = new Date(pubDate).toISOString();
      if (!isWithinWindow(isoDate, windowHours, referenceTime)) continue;
      items.push({
        sourceId: source.id,
        sourceName: source.name,
        sourceTier: source.tier,
        sourceUrl: resolveAtomLink(entry.link),
        title: resolveText(entry.title) || "(no title)",
        content: stripHtml(resolveText(entry.content) || entry.summary || ""),
        publishedAt: isoDate,
        discoveredAt: now,
        guid: entry.id ?? undefined,
      });
    }
  }

  return items;
}

export const rssFetcher: Fetcher = {
  type: "rss",
  async fetch(source, windowHours) {
    const response = await fetch(source.url, {
      headers: { "User-Agent": "NightlyLibrarian/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${source.id}`);
    }
    const xml = await response.text();
    return parseRSSItems(xml, source, windowHours);
  },
};
