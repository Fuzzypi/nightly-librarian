import { describe, test, expect } from "bun:test";
import { sponsorPositionGate } from "../../src/gates/sponsor-position.ts";
import { loadEditorial } from "../../src/config.ts";
import type { Selection, PipelineRun } from "../../src/types.ts";

const editorial = loadEditorial();
const emptySelection: Selection = { signals: [], tryThis: null, memoIgnore: [], dropped: [] };

describe("VG-SPONSOR-POS gate", () => {
  test("passes when sponsor only in allowed position", () => {
    const brief = `Brought to you by CalenCall — AI-powered phone reception.

─── THE 5 SIGNALS ─────────────────────────

1. Some signal about Ollama
   Content here.`;
    const meta: Partial<PipelineRun> = { sponsor: { name: "CalenCall", tagline: "AI-powered phone reception." } };
    const result = sponsorPositionGate(brief, emptySelection, editorial, meta);
    expect(result.passed).toBe(true);
  });

  test("fails when sponsor name appears after signals header", () => {
    const brief = `Brought to you by CalenCall — AI-powered phone reception.

─── THE 5 SIGNALS ─────────────────────────

1. CalenCall is amazing
   You should use CalenCall for everything.`;
    const meta: Partial<PipelineRun> = { sponsor: { name: "CalenCall", tagline: "AI-powered phone reception." } };
    const result = sponsorPositionGate(brief, emptySelection, editorial, meta);
    expect(result.passed).toBe(false);
  });

  test("passes when no sponsor configured", () => {
    const brief = "Some content without sponsor.";
    const result = sponsorPositionGate(brief, emptySelection, editorial, {});
    expect(result.passed).toBe(true);
  });
});
