export type SourceTier = 1 | 2 | 3;
export type FetcherType = "rss" | "hackernews" | "github-releases" | "webpage";

export interface SourceDefinition {
  id: string;
  name: string;
  tier: SourceTier;
  fetcherType: FetcherType;
  url: string;
  category: SignalCategory;
  enabled: boolean;
  fetchOptions?: Record<string, unknown>;
}

export interface SourceRegistry {
  sources: SourceDefinition[];
  fetchWindowHours: number;
  minTier1Sources: number;
}

export type SignalCategory =
  | "model_release"
  | "api_change"
  | "tool_release"
  | "pricing_change"
  | "security_issue"
  | "workflow_pattern"
  | "business_opportunity"
  | "deprecation"
  | "outage"
  | "benchmark";

export interface RawItem {
  sourceId: string;
  sourceName: string;
  sourceTier: SourceTier;
  sourceUrl: string;
  title: string;
  content: string;
  publishedAt: string;
  discoveredAt: string;
  guid?: string;
}

export type EvidenceLevel =
  | "official_changelog"
  | "official_blog"
  | "verified_benchmark"
  | "multi_source"
  | "single_credible"
  | "rumor"
  | "press_release";

export interface CandidateSignal {
  id: string;
  title: string;
  summary: string;
  category: SignalCategory;
  evidenceLevel: EvidenceLevel;
  sourceRefs: SourceRef[];
  entities: string[];
  publishedAt: string;
  discoveredAt: string;
  rawClaims: string[];
  dedupGroup: string | null;
}

export interface SourceRef {
  sourceId: string;
  sourceName: string;
  sourceTier: SourceTier;
  url: string;
}

export interface ScoreDimensions {
  soloDevUsefulness: number;
  actionability: number;
  urgency: number;
  sourceCredibility: number;
  hypeRisk: number;
  costImpact: number;
  productionReadiness: number;
  buildOpportunity: number;
  workflowRelevance: number;
}

export interface ScoreJustifications {
  soloDevUsefulness: string;
  actionability: string;
  urgency: string;
  sourceCredibility: string;
  hypeRisk: string;
  costImpact: string;
  productionReadiness: string;
  buildOpportunity: string;
  workflowRelevance: string;
  worthMentioningReason: string;
  soloDevRelevance: string;
}

export interface ScoredCandidate extends CandidateSignal {
  scores: ScoreDimensions;
  normalizedScore: number;
  justifications: ScoreJustifications;
  worthMentioning: boolean;
}

export type SelectionRole =
  | "signal_1" | "signal_2" | "signal_3" | "signal_4" | "signal_5"
  | "try_this"
  | "memo_ignore"
  | "dropped";

export interface SelectedCandidate extends ScoredCandidate {
  selectedAs: SelectionRole;
  selectionReason: string;
}

export interface Selection {
  signals: SelectedCandidate[];
  tryThis: SelectedCandidate | null;
  memoIgnore: SelectedCandidate[];
  dropped: ScoredCandidate[];
}

export type GateLevel = "blocking" | "advisory";

export interface GateResult {
  gateId: string;
  level: GateLevel;
  passed: boolean;
  violations: string[];
}

export interface GateReport {
  allPassed: boolean;
  blockingPassed: number;
  blockingFailed: number;
  advisoryPassed: number;
  advisoryFailed: number;
  results: GateResult[];
  ranAt: string;
}

export interface PipelineRun {
  runId: string;
  startedAt: string;
  completedAt: string;
  sourcesAttempted: number;
  sourcesFetched: number;
  sourcesFailed: string[];
  rawItemCount: number;
  candidateCount: number;
  dedupMerges: number;
  scoredCount: number;
  selectedCount: number;
  gateReport: GateReport;
  sponsor: SponsorSlot;
  memoPath: string;
  briefPath: string;
  archivePath: string;
}

export interface SponsorSlot {
  name: string;
  tagline: string;
}

export interface SponsorConfig {
  sponsors: Array<{
    name: string;
    tagline: string;
    weight: number;
  }>;
}

export interface ScoringConfig {
  weights: {
    soloDevUsefulness: number;
    actionability: number;
    urgency: number;
    sourceCredibility: number;
    hypeRisk: number;
    costImpact: number;
    productionReadiness: number;
    buildOpportunity: number;
    workflowRelevance: number;
  };
  thresholds: {
    strongCandidate: number;
    conditionalCandidate: number;
    weakCandidate: number;
  };
  maxPossible: number;
}

export interface EditorialConfig {
  bannedSuperlatives: string[];
  hypePatterns: string[];
  affiliatePatterns: string[];
  cultureWarPatterns: string[];
  partisanPatterns: string[];
  moralPanicPatterns: string[];
  vendorCheeringPatterns: string[];
  tryNextPatterns: string[];
  sponsorExplainPatterns: string[];
}

export interface Fetcher {
  type: FetcherType;
  fetch(source: SourceDefinition, windowHours: number): Promise<RawItem[]>;
}

export type Gate = (
  brief: string,
  selection: Selection,
  editorial: EditorialConfig,
  runMeta: Partial<PipelineRun>
) => GateResult;
