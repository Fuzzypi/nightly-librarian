import type { Selection, EditorialConfig, PipelineRun, GateResult, GateReport, Gate } from "../types.ts";
import { sourceRefGate } from "./source-ref.ts";
import { worthMentioningGate } from "./worth-mentioning.ts";
import { soloDevRelevanceGate } from "./solo-dev-relevance.ts";
import { evidenceLevelGate } from "./evidence-level.ts";
import { sponsorPositionGate } from "./sponsor-position.ts";
import { sponsorExplainGate } from "./sponsor-explain.ts";
import { affiliateLanguageGate } from "./affiliate-language.ts";
import { tryNextFramingGate } from "./try-next-framing.ts";
import { superlativesGate } from "./superlatives.ts";
import { hypeLanguageGate } from "./hype-language.ts";
import { cultureWarGate } from "./culture-war.ts";
import { partisanGate } from "./partisan.ts";
import { moralPanicGate } from "./moral-panic.ts";
import { vendorCheeringGate } from "./vendor-cheering.ts";
import { dedupPublicGate } from "./dedup-public.ts";
import { staleCheckGate } from "./stale-check.ts";
import { noIgnorePileGate } from "./no-ignore-pile.ts";
import { signalCountGate } from "./signal-count.ts";

const allGates: Gate[] = [
  signalCountGate,
  sourceRefGate,
  worthMentioningGate,
  soloDevRelevanceGate,
  evidenceLevelGate,
  sponsorPositionGate,
  sponsorExplainGate,
  affiliateLanguageGate,
  tryNextFramingGate,
  superlativesGate,
  hypeLanguageGate,
  cultureWarGate,
  partisanGate,
  moralPanicGate,
  vendorCheeringGate,
  dedupPublicGate,
  staleCheckGate,
  noIgnorePileGate,
];

export function runGates(
  brief: string,
  selection: Selection,
  editorial: EditorialConfig,
  runMeta: Partial<PipelineRun>
): GateReport {
  const results: GateResult[] = allGates.map(gate => gate(brief, selection, editorial, runMeta));

  return {
    allPassed: results.every(r => r.level !== "blocking" || r.passed),
    blockingPassed: results.filter(r => r.level === "blocking" && r.passed).length,
    blockingFailed: results.filter(r => r.level === "blocking" && !r.passed).length,
    advisoryPassed: results.filter(r => r.level === "advisory" && r.passed).length,
    advisoryFailed: results.filter(r => r.level === "advisory" && !r.passed).length,
    results,
    ranAt: new Date().toISOString(),
  };
}
