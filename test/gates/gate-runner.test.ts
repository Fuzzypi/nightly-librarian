import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { runGates } from "../../src/gates/index.ts";
import { loadEditorial } from "../../src/config.ts";
import type { Selection, ScoredCandidate, SelectedCandidate, PipelineRun } from "../../src/types.ts";

const editorial = loadEditorial();
const scoredFixture: ScoredCandidate[] = JSON.parse(
  readFileSync(join(import.meta.dir, "..", "fixtures", "candidates-scored.json"), "utf-8")
);

function makeSelection(candidates: ScoredCandidate[]): Selection {
  const signals: SelectedCandidate[] = candidates.slice(0, 5).map((c, i) => ({
    ...c,
    selectedAs: `signal_${i + 1}` as SelectedCandidate["selectedAs"],
    selectionReason: `Rank #${i + 1}`,
  }));
  const tryThis: SelectedCandidate | null = candidates.length > 5 ? {
    ...candidates[5],
    selectedAs: "try_this",
    selectionReason: "Highest actionability",
  } : null;
  return { signals, tryThis, memoIgnore: [], dropped: [] };
}

describe("gate runner integration", () => {
  test("clean golden brief passes all blocking gates", () => {
    const brief = readFileSync(join(import.meta.dir, "..", "fixtures", "brief-clean.md"), "utf-8");
    const selection = makeSelection(scoredFixture);
    const meta: Partial<PipelineRun> = {
      sponsor: { name: "CalenCall", tagline: "AI-powered phone reception for solo tradespeople." },
    };

    const report = runGates(brief, selection, editorial, meta);
    const failed = report.results.filter(r => !r.passed && r.level === "blocking");
    if (failed.length > 0) {
      console.log("Failed gates:", failed.map(f => `${f.gateId}: ${f.violations.join(", ")}`));
    }
    expect(report.allPassed).toBe(true);
    expect(report.blockingFailed).toBe(0);
  });

  test("runs exactly 18 gates", () => {
    const brief = readFileSync(join(import.meta.dir, "..", "fixtures", "brief-clean.md"), "utf-8");
    const selection = makeSelection(scoredFixture);
    const report = runGates(brief, selection, editorial, {});
    expect(report.results.length).toBe(18);
  });

  test("brief with superlative fails VG-SUPERLATIVE", () => {
    const brief = readFileSync(join(import.meta.dir, "..", "fixtures", "brief-clean.md"), "utf-8")
      .replace("A day of tooling updates.", "A revolutionary day of tooling updates.");
    const selection = makeSelection(scoredFixture);
    const report = runGates(brief, selection, editorial, {});
    const supGate = report.results.find(r => r.gateId === "VG-SUPERLATIVE");
    expect(supGate?.passed).toBe(false);
  });

  test("brief with ignore pile fails VG-NO-IGNORE", () => {
    const brief = readFileSync(join(import.meta.dir, "..", "fixtures", "brief-clean.md"), "utf-8") +
      "\n─── IGNORE THIS ────────────────────────────\nSome noise to ignore.";
    const selection = makeSelection(scoredFixture);
    const report = runGates(brief, selection, editorial, {});
    const ignoreGate = report.results.find(r => r.gateId === "VG-NO-IGNORE");
    expect(ignoreGate?.passed).toBe(false);
  });

  test("brief with affiliate language fails VG-AFFILIATE", () => {
    const brief = readFileSync(join(import.meta.dir, "..", "fixtures", "brief-clean.md"), "utf-8")
      .replace("Review the changes", "Use my link to get a discount code");
    const selection = makeSelection(scoredFixture);
    const report = runGates(brief, selection, editorial, {});
    const affGate = report.results.find(r => r.gateId === "VG-AFFILIATE");
    expect(affGate?.passed).toBe(false);
  });

  test("brief with hype language fails VG-HYPE", () => {
    const brief = readFileSync(join(import.meta.dir, "..", "fixtures", "brief-clean.md"), "utf-8")
      .replace("A day of tooling updates.", "This changes everything for developers.");
    const selection = makeSelection(scoredFixture);
    const report = runGates(brief, selection, editorial, {});
    const hypeGate = report.results.find(r => r.gateId === "VG-HYPE");
    expect(hypeGate?.passed).toBe(false);
  });

  test("brief with vendor cheerleading fails VG-VENDOR", () => {
    const brief = readFileSync(join(import.meta.dir, "..", "fixtures", "brief-clean.md"), "utf-8")
      .replace("A day of tooling updates.", "We are thrilled to see these amazing new updates.");
    const selection = makeSelection(scoredFixture);
    const report = runGates(brief, selection, editorial, {});
    const vendorGate = report.results.find(r => r.gateId === "VG-VENDOR");
    expect(vendorGate?.passed).toBe(false);
  });
});
