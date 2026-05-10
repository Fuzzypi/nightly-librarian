import type { SourceDefinition, RawItem } from "../types.ts";

export interface Fetcher {
  type: string;
  fetch(source: SourceDefinition, windowHours: number): Promise<RawItem[]>;
}
