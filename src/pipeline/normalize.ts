import type { RawItem, CandidateSignal, EvidenceLevel, SourceRef } from "../types.ts";
import { candidateId } from "../util/hash.ts";
import { extractEntities, extractClaims, summarizeText, stripHtml } from "../util/text.ts";

function determineEvidenceLevel(item: RawItem): EvidenceLevel {
  const url = item.sourceUrl.toLowerCase();
  const isChangelog = url.includes("changelog") || url.includes("release") || url.includes("releases");
  const isBlog = url.includes("blog") || url.includes("news");

  if (item.sourceTier === 1 && isChangelog) return "official_changelog";
  if (item.sourceTier === 1 && isBlog) return "official_blog";
  if (item.sourceTier === 1) return "official_blog";
  if (item.sourceTier === 2) return "single_credible";
  return "rumor";
}

export function normalizeItems(rawItems: RawItem[]): CandidateSignal[] {
  const now = new Date().toISOString();
  return rawItems.map(item => {
    const plainContent = stripHtml(item.content);
    const entities = extractEntities(item.title + " " + plainContent);
    const claims = extractClaims(plainContent);
    const summary = summarizeText(plainContent, 3);
    const sourceRef: SourceRef = {
      sourceId: item.sourceId,
      sourceName: item.sourceName,
      sourceTier: item.sourceTier,
      url: item.sourceUrl,
    };

    return {
      id: candidateId(item.sourceId, item.title, item.publishedAt),
      title: item.title,
      summary: summary || plainContent.slice(0, 200),
      category: guessCategory(item, plainContent),
      evidenceLevel: determineEvidenceLevel(item),
      sourceRefs: [sourceRef],
      entities,
      publishedAt: item.publishedAt,
      discoveredAt: item.discoveredAt ?? now,
      rawClaims: claims,
      dedupGroup: null,
    };
  });
}

function guessCategory(item: RawItem, content: string): CandidateSignal["category"] {
  const text = (item.title + " " + content).toLowerCase();

  if (/deprecat|end.of.life|sunset|removed|breaking change/.test(text)) return "deprecation";
  if (/security|vulnerability|cve-|exploit|breach/.test(text)) return "security_issue";
  if (/outage|down|incident|degraded/.test(text)) return "outage";
  if (/price|pricing|cost|free tier|token cost|\$/.test(text)) return "pricing_change";
  if (/benchmark|eval|leaderboard|mmlu|humaneval/.test(text)) return "benchmark";
  if (/api|sdk|endpoint|breaking change|migration/.test(text)) return "api_change";
  if (/release|launch|v\d|version \d|new model|gpt-|claude |gemini/.test(text)) return "model_release";
  if (/tool|plugin|extension|integration|framework/.test(text)) return "tool_release";
  if (/workflow|pattern|technique|prompt|agent/.test(text)) return "workflow_pattern";
  if (/business|opportunity|market|monetiz/.test(text)) return "business_opportunity";

  return item.sourceTier === 1 ? "model_release" : "workflow_pattern";
}
