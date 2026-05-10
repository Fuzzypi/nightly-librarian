import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { loadSources, loadScoring, loadEditorial, loadSponsors, pickSponsor } from "./config.ts";
import { fetchAllSources } from "./pipeline/fetch.ts";
import { extractItems } from "./pipeline/extract.ts";
import { normalizeItems } from "./pipeline/normalize.ts";
import { deduplicateCandidates } from "./pipeline/dedup.ts";
import { scoreCandidates } from "./pipeline/score.ts";
import { selectCandidates } from "./pipeline/select.ts";
import { generateMemo } from "./pipeline/memo.ts";
import { generateBrief } from "./pipeline/brief.ts";
import { verifyBrief } from "./pipeline/verify.ts";
import { writeArchive, getArchiveDir } from "./pipeline/archive.ts";
import { runTimestamp } from "./util/date.ts";
import { logger } from "./util/logger.ts";
import type { PipelineRun, RawItem, CandidateSignal, ScoredCandidate, Selection, GateReport } from "./types.ts";

const command = process.argv[2];
const runFlag = process.argv.indexOf("--run");
const runId = runFlag !== -1 ? process.argv[runFlag + 1] : undefined;
const fixtureFlag = process.argv.includes("--fixture");

function findLatestRun(): string | undefined {
  const archiveDir = getArchiveDir();
  if (!existsSync(archiveDir)) return undefined;
  const dirs = readdirSync(archiveDir).sort().reverse();
  return dirs[0];
}

function loadRunFile<T>(runDir: string, filename: string): T {
  const filePath = join(getArchiveDir(), runDir, filename);
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

async function runFetch(): Promise<{ rawItems: RawItem[]; candidates: CandidateSignal[]; dedupMerges: number; ts: string; sourcesAttempted: number; sourcesFetched: number; sourcesFailed: string[] }> {
  const sources = loadSources();
  logger.info("fetch", `Fetching from ${sources.sources.filter(s => s.enabled).length} sources...`);

  let rawItems: RawItem[];
  let sourcesAttempted = 0;
  let sourcesFetched = 0;
  let sourcesFailed: string[] = [];

  if (fixtureFlag) {
    rawItems = loadFixtureItems();
    sourcesAttempted = new Set(rawItems.map(i => i.sourceId)).size;
    sourcesFetched = sourcesAttempted;
  } else {
    const result = await fetchAllSources(sources);
    rawItems = result.items;
    sourcesAttempted = result.sourcesAttempted;
    sourcesFetched = result.sourcesFetched;
    sourcesFailed = result.sourcesFailed;
  }

  const extracted = extractItems(rawItems);
  const normalized = normalizeItems(extracted);
  const { unique, mergeCount } = deduplicateCandidates(normalized);

  logger.info("dedup", `${mergeCount} merges → ${unique.length} unique candidates`);

  const ts = runTimestamp();
  return { rawItems, candidates: unique, dedupMerges: mergeCount, ts, sourcesAttempted, sourcesFetched, sourcesFailed };
}

function loadFixtureItems(): RawItem[] {
  logger.info("fixture", "Loading fixture data (synthetic items)");
  return generateSyntheticItems();
}

function generateSyntheticItems(): RawItem[] {
  const now = new Date().toISOString();
  const recent = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  return [
    { sourceId: "openai-blog", sourceName: "OpenAI Blog", sourceTier: 1, sourceUrl: "https://openai.com/blog/gpt5-release", title: "GPT-5 Released with Enhanced Reasoning", content: "OpenAI has released GPT-5 with 40% improvement in coding benchmarks. The new model supports 1M token context and costs 30% less than GPT-4. Available now via API.", publishedAt: recent, discoveredAt: now },
    { sourceId: "anthropic-news", sourceName: "Anthropic News", sourceTier: 1, sourceUrl: "https://anthropic.com/news/claude-code-update", title: "Claude Code Gets Multi-File Editing", content: "Anthropic shipped multi-file editing for Claude Code. Solo developers can now refactor across files in a single command. The feature is available in Claude Code CLI v2.0.", publishedAt: recent, discoveredAt: now },
    { sourceId: "github-blog", sourceName: "GitHub Blog", sourceTier: 1, sourceUrl: "https://github.blog/copilot-agent-mode", title: "GitHub Copilot Agent Mode GA", content: "GitHub Copilot agent mode is now generally available. It can handle multi-step coding tasks autonomously. Free for individual developers on GitHub Pro.", publishedAt: recent, discoveredAt: now },
    { sourceId: "ollama-releases", sourceName: "Ollama Releases", sourceTier: 1, sourceUrl: "https://github.com/ollama/ollama/releases/v0.8.0", title: "Ollama v0.8.0: Vision Model Support", content: "Ollama now supports vision models locally. Run multimodal inference on your laptop with Llama 3.2 Vision. No API key required. Supports Mac M-series and NVIDIA GPUs.", publishedAt: recent, discoveredAt: now },
    { sourceId: "vercel-ai-sdk", sourceName: "Vercel AI SDK Releases", sourceTier: 1, sourceUrl: "https://github.com/vercel/ai/releases/v5.0", title: "Vercel AI SDK 5.0: Streaming Improvements", content: "Vercel AI SDK 5.0 ships with 50% faster streaming and built-in tool calling. Breaking change: useChat hook API updated. Migration guide available.", publishedAt: recent, discoveredAt: now },
    { sourceId: "langchain-releases", sourceName: "LangChain Releases", sourceTier: 1, sourceUrl: "https://github.com/langchain-ai/langchainjs/releases/v0.4", title: "LangChain.js v0.4: Simplified Agent API", content: "LangChain.js v0.4 simplifies the agent creation API. New createAgent() function replaces the previous 5-step setup. Reduces boilerplate by 60%.", publishedAt: recent, discoveredAt: now },
    { sourceId: "huggingface-blog", sourceName: "Hugging Face Blog", sourceTier: 1, sourceUrl: "https://huggingface.co/blog/new-leaderboard", title: "Hugging Face Updates Open LLM Leaderboard", content: "The Open LLM Leaderboard now includes real-world coding tasks. DeepSeek V3 takes the top spot for code generation, scoring 89% on HumanEval+.", publishedAt: recent, discoveredAt: now },
    { sourceId: "hackernews-ai", sourceName: "Hacker News (AI)", sourceTier: 2, sourceUrl: "https://news.ycombinator.com/item?id=99999", title: "Show HN: Open-source AI code review tool built with GPT-4o", content: "Built an open-source AI code review tool using the OpenAI API with GPT-4o. 200 points, 45 comments. Supports Python, TypeScript, Go.", publishedAt: recent, discoveredAt: now, guid: "99999" },
    { sourceId: "hackernews-ai", sourceName: "Hacker News (AI)", sourceTier: 2, sourceUrl: "https://news.ycombinator.com/item?id=99998", title: "Claude API pricing reduced by 25%", content: "Anthropic reduced Claude API pricing by 25% across all models. 150 points, 80 comments. Significant cost savings for API-heavy applications.", publishedAt: recent, discoveredAt: now, guid: "99998" },
    { sourceId: "hackernews-ai", sourceName: "Hacker News (AI)", sourceTier: 2, sourceUrl: "https://news.ycombinator.com/item?id=99997", title: "Local LLM benchmark: M4 Mac vs RTX 5090", content: "Detailed benchmarks comparing local LLM inference. M4 Max achieves 45 tok/s on Llama 70B vs 62 tok/s on RTX 5090. Both viable for solo dev workflows.", publishedAt: recent, discoveredAt: now, guid: "99997" },
  ];
}

async function runScore(targetRun?: string): Promise<{ scored: ScoredCandidate[]; selection: Selection; ts: string }> {
  const run = targetRun ?? findLatestRun();
  if (!run) { logger.error("score", "No run found"); process.exit(1); }

  const candidates = loadRunFile<CandidateSignal[]>(run, "candidates.json");
  const scoring = loadScoring();
  const editorial = loadEditorial();

  const scored = scoreCandidates(candidates, scoring, editorial);
  logger.info("score", `${scored.length} candidates scored. ${scored.filter(s => s.worthMentioning).length} worth mentioning.`);

  const selection = selectCandidates(scored);
  return { scored, selection, ts: run };
}

async function runDraft(targetRun?: string): Promise<{ memo: string; brief: string; ts: string }> {
  const run = targetRun ?? findLatestRun();
  if (!run) { logger.error("draft", "No run found"); process.exit(1); }

  const scored = loadRunFile<ScoredCandidate[]>(run, "scored.json");
  const selection = loadRunFile<Selection>(run, "selection.json");
  const sponsors = loadSponsors();
  const sponsor = pickSponsor(sponsors);

  const runMeta: Partial<PipelineRun> = { runId: run, sponsor };

  const memo = generateMemo(selection, runMeta, null, scored);
  const brief = generateBrief(selection, sponsor);

  logger.info("draft", `Memo: ${memo.split(/\s+/).length} words. Brief: ${brief.split(/\s+/).length} words.`);
  return { memo, brief, ts: run };
}

async function runVerify(targetRun?: string): Promise<GateReport> {
  const run = targetRun ?? findLatestRun();
  if (!run) { logger.error("verify", "No run found"); process.exit(1); }

  const brief = readFileSync(join(getArchiveDir(), run, "brief.md"), "utf-8");
  const selection = loadRunFile<Selection>(run, "selection.json");
  const editorial = loadEditorial();

  let runMeta: Partial<PipelineRun> = {};
  try {
    runMeta = loadRunFile<PipelineRun>(run, "run.json");
  } catch { /* ok */ }

  const report = verifyBrief(brief, selection, editorial, runMeta);

  logger.info("verify", `Running ${report.results.length} blocking gates...`);
  for (const r of report.results) {
    const status = r.passed ? "PASS" : "FAIL";
    console.log(`[${status}] ${r.gateId}${r.violations.length > 0 ? ": " + r.violations[0] : ""}`);
  }

  const passCount = report.blockingPassed;
  const failCount = report.blockingFailed;
  logger.info("verify", `${passCount}/${passCount + failCount} blocking gates passed`);

  if (!report.allPassed) {
    logger.error("verify", `BLOCKED — ${failCount} gate(s) failed`);
  }

  return report;
}

async function runFull(): Promise<void> {
  const startedAt = new Date().toISOString();
  const runUUID = randomUUID();
  const ts = runTimestamp();

  logger.info("run", "Starting full pipeline run...");

  const { rawItems, candidates, dedupMerges, sourcesAttempted, sourcesFetched, sourcesFailed } = await runFetch();

  const scoring = loadScoring();
  const editorial = loadEditorial();
  const scored = scoreCandidates(candidates, scoring, editorial);
  logger.info("score", `${scored.length} candidates scored. ${scored.filter(s => s.worthMentioning).length} worth mentioning.`);

  const selection = selectCandidates(scored);
  const sponsors = loadSponsors();
  const sponsor = pickSponsor(sponsors);

  const partialMeta: Partial<PipelineRun> = {
    runId: runUUID,
    startedAt,
    sourcesAttempted,
    sourcesFetched,
    sourcesFailed,
    rawItemCount: rawItems.length,
    candidateCount: candidates.length,
    dedupMerges,
    scoredCount: scored.length,
    selectedCount: selection.signals.length + (selection.tryThis ? 1 : 0),
    sponsor,
  };

  const brief = generateBrief(selection, sponsor);
  const gateReport = verifyBrief(brief, selection, editorial, partialMeta);
  const memo = generateMemo(selection, partialMeta, gateReport, scored);

  logger.info("draft", `Memo: ${memo.split(/\s+/).length} words. Brief: ${brief.split(/\s+/).length} words.`);

  for (const r of gateReport.results) {
    const status = r.passed ? "PASS" : "FAIL";
    console.log(`[${status}] ${r.gateId}${r.violations.length > 0 ? ": " + r.violations[0] : ""}`);
  }
  logger.info("verify", `${gateReport.blockingPassed}/${gateReport.blockingPassed + gateReport.blockingFailed} blocking gates passed`);

  const completedAt = new Date().toISOString();
  const runMeta: PipelineRun = {
    ...(partialMeta as PipelineRun),
    completedAt,
    gateReport,
    memoPath: `archive/runs/${ts}/memo.md`,
    briefPath: `archive/runs/${ts}/brief.md`,
    archivePath: `archive/runs/${ts}`,
  };

  const archivePath = writeArchive({
    runMeta, rawItems, candidates, scored, selection, memo, brief, gateReport,
  }, ts);

  logger.info("archive", `Run saved to ${archivePath}`);

  if (gateReport.allPassed) {
    logger.info("run", `DONE — brief ready for review at ${archivePath}/brief.md`);
  } else {
    logger.error("run", `BLOCKED — ${gateReport.blockingFailed} gate(s) failed`);
    process.exit(1);
  }
}

async function runInspect(targetRun?: string): Promise<void> {
  const run = targetRun ?? findLatestRun();
  if (!run) { logger.error("inspect", "No runs found in archive"); process.exit(1); }

  const runDir = join(getArchiveDir(), run);
  console.log(`\nRun: ${run}`);
  console.log(`Directory: ${runDir}`);

  try {
    const meta = loadRunFile<PipelineRun>(run, "run.json");
    console.log(`\nStarted:   ${meta.startedAt}`);
    console.log(`Completed: ${meta.completedAt}`);
    console.log(`Sources:   ${meta.sourcesFetched}/${meta.sourcesAttempted} fetched`);
    console.log(`Raw items: ${meta.rawItemCount}`);
    console.log(`Candidates: ${meta.candidateCount} (${meta.dedupMerges} merges)`);
    console.log(`Selected:  ${meta.selectedCount}`);
    console.log(`Sponsor:   ${meta.sponsor.name}`);
    console.log(`\nGates: ${meta.gateReport.blockingPassed}/${meta.gateReport.blockingPassed + meta.gateReport.blockingFailed} blocking passed`);
    if (!meta.gateReport.allPassed) {
      const failed = meta.gateReport.results.filter(r => !r.passed && r.level === "blocking");
      for (const f of failed) {
        console.log(`  FAIL: ${f.gateId} — ${f.violations[0] ?? ""}`);
      }
    }
  } catch {
    console.log("(run.json not found or invalid)");
  }
}

switch (command) {
  case "fetch": {
    const { rawItems, candidates, dedupMerges, ts, sourcesAttempted, sourcesFetched, sourcesFailed } = await runFetch();
    const { writeArchive: wa } = await import("./pipeline/archive.ts");
    const emptyGateReport: GateReport = { allPassed: false, blockingPassed: 0, blockingFailed: 0, advisoryPassed: 0, advisoryFailed: 0, results: [], ranAt: "" };
    wa({
      runMeta: { runId: randomUUID(), startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), sourcesAttempted, sourcesFetched, sourcesFailed, rawItemCount: rawItems.length, candidateCount: candidates.length, dedupMerges, scoredCount: 0, selectedCount: 0, gateReport: emptyGateReport, sponsor: { name: "", tagline: "" }, memoPath: "", briefPath: "", archivePath: "" },
      rawItems, candidates, scored: [], selection: { signals: [], tryThis: null, memoIgnore: [], dropped: [] }, memo: "", brief: "", gateReport: emptyGateReport,
    }, ts);
    logger.info("fetch", `Wrote archive/runs/${ts}/`);
    break;
  }
  case "score": {
    const { scored, selection, ts } = await runScore(runId);
    const { writeFileSync: wf } = await import("fs");
    const { join: j } = await import("path");
    wf(j(getArchiveDir(), ts, "scored.json"), JSON.stringify(scored, null, 2));
    wf(j(getArchiveDir(), ts, "selection.json"), JSON.stringify(selection, null, 2));
    logger.info("score", `Updated ${ts}/scored.json and selection.json`);
    break;
  }
  case "draft": {
    const { memo, brief, ts } = await runDraft(runId);
    const { writeFileSync: wf } = await import("fs");
    const { join: j } = await import("path");
    wf(j(getArchiveDir(), ts, "memo.md"), memo);
    wf(j(getArchiveDir(), ts, "brief.md"), brief);
    logger.info("draft", `Updated ${ts}/memo.md and brief.md`);
    break;
  }
  case "verify": {
    const report = await runVerify(runId);
    process.exit(report.allPassed ? 0 : 1);
    break;
  }
  case "run":
    await runFull();
    break;
  case "inspect":
    await runInspect(runId);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.error("Commands: fetch, score, draft, verify, run, inspect");
    process.exit(1);
}
