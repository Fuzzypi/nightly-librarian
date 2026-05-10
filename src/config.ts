import { readFileSync } from "fs";
import { join } from "path";
import type { SourceRegistry, ScoringConfig, EditorialConfig, SponsorConfig, SponsorSlot } from "./types.ts";

const CONFIG_DIR = join(import.meta.dir, "..", "config");

export function loadSources(): SourceRegistry {
  return JSON.parse(readFileSync(join(CONFIG_DIR, "sources.json"), "utf-8"));
}

export function loadScoring(): ScoringConfig {
  return JSON.parse(readFileSync(join(CONFIG_DIR, "scoring.json"), "utf-8"));
}

export function loadEditorial(): EditorialConfig {
  return JSON.parse(readFileSync(join(CONFIG_DIR, "editorial.json"), "utf-8"));
}

export function loadSponsors(): SponsorConfig {
  return JSON.parse(readFileSync(join(CONFIG_DIR, "sponsors.json"), "utf-8"));
}

export function pickSponsor(config: SponsorConfig): SponsorSlot {
  const totalWeight = config.sponsors.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const sponsor of config.sponsors) {
    roll -= sponsor.weight;
    if (roll <= 0) {
      return { name: sponsor.name, tagline: sponsor.tagline };
    }
  }
  const last = config.sponsors[config.sponsors.length - 1];
  return { name: last.name, tagline: last.tagline };
}
