import { describe, test, expect } from "bun:test";
import { superlativesGate } from "../../src/gates/superlatives.ts";
import { loadEditorial } from "../../src/config.ts";
import type { Selection, PipelineRun } from "../../src/types.ts";

const editorial = loadEditorial();
const emptySelection: Selection = { signals: [], tryThis: null, memoIgnore: [], dropped: [] };
const emptyMeta: Partial<PipelineRun> = {};

describe("VG-SUPERLATIVE gate", () => {
  test("passes on clean brief without superlatives", () => {
    const brief = "This update improves performance by 30% according to benchmarks.";
    const result = superlativesGate(brief, emptySelection, editorial, emptyMeta);
    expect(result.passed).toBe(true);
    expect(result.gateId).toBe("VG-SUPERLATIVE");
  });

  test("fails on unsupported superlative", () => {
    const brief = "This is the best AI tool ever released.";
    const result = superlativesGate(brief, emptySelection, editorial, emptyMeta);
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0]).toContain("best");
  });

  test("passes when superlative has adjacent evidence", () => {
    const brief = "This is the best performer, scoring 95% on HumanEval benchmark.";
    const result = superlativesGate(brief, emptySelection, editorial, emptyMeta);
    expect(result.passed).toBe(true);
  });

  test("fails on revolutionary without evidence", () => {
    const brief = "A revolutionary new approach to code generation.";
    const result = superlativesGate(brief, emptySelection, editorial, emptyMeta);
    expect(result.passed).toBe(false);
  });

  test("fails on game-changing without evidence", () => {
    const brief = "This is a game-changing update for developers.";
    const result = superlativesGate(brief, emptySelection, editorial, emptyMeta);
    expect(result.passed).toBe(false);
  });
});
