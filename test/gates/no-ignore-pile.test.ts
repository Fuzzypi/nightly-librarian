import { describe, test, expect } from "bun:test";
import { noIgnorePileGate } from "../../src/gates/no-ignore-pile.ts";
import { loadEditorial } from "../../src/config.ts";
import type { Selection, PipelineRun } from "../../src/types.ts";

const editorial = loadEditorial();
const emptySelection: Selection = { signals: [], tryThis: null, memoIgnore: [], dropped: [] };
const emptyMeta: Partial<PipelineRun> = {};

describe("VG-NO-IGNORE gate", () => {
  test("passes on brief without ignore pile", () => {
    const brief = `THE 5 SIGNALS

1. Some signal
   Content here.

TRY THIS

Something to try.

LIBRARIAN'S VERDICT

A good day.`;
    const result = noIgnorePileGate(brief, emptySelection, editorial, emptyMeta);
    expect(result.passed).toBe(true);
  });

  test("fails when brief contains 'ignore this'", () => {
    const brief = `THE 5 SIGNALS

1. Some signal

─── IGNORE THIS ────────────────────────────

Some noise to ignore this week.`;
    const result = noIgnorePileGate(brief, emptySelection, editorial, emptyMeta);
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  test("fails when brief contains 'safe to ignore'", () => {
    const brief = "This announcement is safe to ignore for most developers.";
    const result = noIgnorePileGate(brief, emptySelection, editorial, emptyMeta);
    expect(result.passed).toBe(false);
  });

  test("fails on ignore section header", () => {
    const brief = "## Ignore Pile\n\nStuff to skip.";
    const result = noIgnorePileGate(brief, emptySelection, editorial, emptyMeta);
    expect(result.passed).toBe(false);
  });
});
