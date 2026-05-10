import type { RawItem } from "../types.ts";

export function extractItems(rawItems: RawItem[]): RawItem[] {
  return rawItems.filter(item => {
    if (!item.title || item.title === "(no title)") return false;
    if (!item.sourceUrl) return false;
    return true;
  });
}
