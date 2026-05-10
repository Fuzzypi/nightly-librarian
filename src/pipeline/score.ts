import type { CandidateSignal, ScoredCandidate, ScoreDimensions, ScoreJustifications, ScoringConfig, EditorialConfig } from "../types.ts";
import { containsAny } from "../util/text.ts";
import { hoursAgo } from "../util/date.ts";

const SOLO_DEV_TOOLS = [
  "cursor", "copilot", "claude code", "ollama", "cody",
  "continue", "aider", "gptengineer", "v0", "bolt",
];

const ENTERPRISE_TERMS = ["enterprise", "team plan", "organization", "admin console", "sso"];

function clamp(val: number, min: number = 0, max: number = 10): number {
  return Math.max(min, Math.min(max, val));
}

function computeDimensions(candidate: CandidateSignal, editorial: EditorialConfig): ScoreDimensions {
  const text = (candidate.title + " " + candidate.summary + " " + candidate.rawClaims.join(" ")).toLowerCase();
  const cat = candidate.category;
  const tier = Math.min(...candidate.sourceRefs.map(r => r.sourceTier));
  const evidence = candidate.evidenceLevel;

  let soloDevUsefulness = 5;
  if (SOLO_DEV_TOOLS.some(t => text.includes(t))) soloDevUsefulness += 2;
  if (cat === "tool_release" || cat === "api_change") soloDevUsefulness += 2;
  if (ENTERPRISE_TERMS.some(t => text.includes(t)) && !SOLO_DEV_TOOLS.some(t => text.includes(t))) soloDevUsefulness -= 3;

  let actionability = 4;
  if (cat === "api_change" || cat === "tool_release") actionability += 3;
  if (cat === "pricing_change") actionability += 2;
  if (cat === "benchmark") actionability -= 2;

  let urgency = 3;
  if (cat === "deprecation" || cat === "security_issue") urgency += 4;
  if (cat === "outage") urgency += 2;
  try {
    if (hoursAgo(candidate.publishedAt) < 6) urgency += 1;
  } catch { /* invalid date */ }

  let sourceCredibility = tier === 1 ? 8 : tier === 2 ? 5 : 3;
  if (evidence === "official_changelog") sourceCredibility += 2;
  if (evidence === "rumor") sourceCredibility -= 2;

  let hypeRisk = 3;
  if (containsAny(text, editorial.hypePatterns).length > 0) hypeRisk += 3;
  if (containsAny(text, editorial.bannedSuperlatives).length > 0) hypeRisk += 2;
  if (evidence === "official_changelog") hypeRisk -= 2;

  let costImpact = 2;
  if (cat === "pricing_change") costImpact += 6;
  if (/free tier|pricing|cost|token price/i.test(text)) costImpact += 2;

  let productionReadiness = 5;
  if (evidence === "official_changelog" || cat === "tool_release") productionReadiness += 3;
  if (/coming soon|preview|beta|alpha|experimental/i.test(text)) productionReadiness -= 4;

  let buildOpportunity = 3;
  if (cat === "business_opportunity") buildOpportunity += 4;
  if (/new api|new capability|now supports|enables/i.test(text)) buildOpportunity += 2;

  let workflowRelevance = 4;
  if (cat === "workflow_pattern") workflowRelevance += 3;
  if (SOLO_DEV_TOOLS.some(t => text.includes(t))) workflowRelevance += 2;

  return {
    soloDevUsefulness: clamp(soloDevUsefulness),
    actionability: clamp(actionability),
    urgency: clamp(urgency),
    sourceCredibility: clamp(sourceCredibility),
    hypeRisk: clamp(hypeRisk),
    costImpact: clamp(costImpact),
    productionReadiness: clamp(productionReadiness),
    buildOpportunity: clamp(buildOpportunity),
    workflowRelevance: clamp(workflowRelevance),
  };
}

function applyWeights(dims: ScoreDimensions, weights: ScoringConfig["weights"]): number {
  return (
    dims.soloDevUsefulness * weights.soloDevUsefulness +
    dims.actionability * weights.actionability +
    dims.urgency * weights.urgency +
    dims.sourceCredibility * weights.sourceCredibility +
    (10 - dims.hypeRisk) * weights.hypeRisk +
    dims.costImpact * weights.costImpact +
    dims.productionReadiness * weights.productionReadiness +
    dims.buildOpportunity * weights.buildOpportunity +
    dims.workflowRelevance * weights.workflowRelevance
  );
}

function generateJustifications(candidate: CandidateSignal, dims: ScoreDimensions): ScoreJustifications {
  const j = (dim: string, val: number, reason: string) => `${dim}: ${val}/10 — ${reason}`;
  const cat = candidate.category;
  const tier = Math.min(...candidate.sourceRefs.map(r => r.sourceTier));

  const justifications: ScoreJustifications = {
    soloDevUsefulness: j("soloDevUsefulness", dims.soloDevUsefulness, `category: ${cat}, tier: ${tier}`),
    actionability: j("actionability", dims.actionability, `category: ${cat}`),
    urgency: j("urgency", dims.urgency, `category: ${cat}`),
    sourceCredibility: j("sourceCredibility", dims.sourceCredibility, `tier ${tier}, evidence: ${candidate.evidenceLevel}`),
    hypeRisk: j("hypeRisk", dims.hypeRisk, `evidence: ${candidate.evidenceLevel}`),
    costImpact: j("costImpact", dims.costImpact, `category: ${cat}`),
    productionReadiness: j("productionReadiness", dims.productionReadiness, `evidence: ${candidate.evidenceLevel}`),
    buildOpportunity: j("buildOpportunity", dims.buildOpportunity, `category: ${cat}`),
    workflowRelevance: j("workflowRelevance", dims.workflowRelevance, `category: ${cat}`),
    worthMentioningReason: "",
    soloDevRelevance: "",
  };

  const topDims = Object.entries(dims)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  justifications.worthMentioningReason = `Top dimensions: ${topDims}. Source: ${candidate.sourceRefs[0]?.sourceName ?? "unknown"}.`;

  justifications.soloDevRelevance = generateSoloDevRelevance(candidate, dims);

  return justifications;
}

function generateSoloDevRelevance(candidate: CandidateSignal, dims: ScoreDimensions): string {
  const parts: string[] = [];
  const cat = candidate.category;

  if (cat === "tool_release" || cat === "api_change") {
    parts.push("Directly affects tools and APIs that solo developers rely on in daily workflows.");
  } else if (cat === "pricing_change") {
    parts.push("Pricing changes directly impact the operating costs solo developers pay for AI services.");
  } else if (cat === "deprecation" || cat === "security_issue") {
    parts.push("Requires immediate attention and action from anyone running affected services or dependencies.");
  } else if (cat === "model_release") {
    parts.push("New model capabilities may unlock new solo-dev workflows, products, or cost savings worth evaluating.");
  } else if (cat === "workflow_pattern") {
    parts.push("Workflow improvement directly applicable to solo development practices and daily productivity.");
  } else if (cat === "business_opportunity") {
    parts.push("New capability creates a buildable product opportunity that solo developers can pursue independently.");
  } else {
    parts.push("General AI development signal with indirect but notable relevance to solo developer workflows.");
  }

  if (dims.actionability >= 7) parts.push("Highly actionable — concrete steps available.");
  if (dims.buildOpportunity >= 7) parts.push("Opens new build possibilities.");

  return parts.join(" ");
}

export function scoreCandidates(
  candidates: CandidateSignal[],
  config: ScoringConfig,
  editorial: EditorialConfig
): ScoredCandidate[] {
  return candidates.map(candidate => {
    const dims = computeDimensions(candidate, editorial);
    const raw = applyWeights(dims, config.weights);
    const normalized = Math.round((raw / config.maxPossible) * 100 * 10) / 10;

    return {
      ...candidate,
      scores: dims,
      normalizedScore: normalized,
      justifications: generateJustifications(candidate, dims),
      worthMentioning: normalized >= config.thresholds.conditionalCandidate,
    };
  });
}
