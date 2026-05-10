import type { Selection, EditorialConfig, PipelineRun, GateReport } from "../types.ts";
import { runGates } from "../gates/index.ts";

export function verifyBrief(
  brief: string,
  selection: Selection,
  editorial: EditorialConfig,
  runMeta: Partial<PipelineRun>
): GateReport {
  return runGates(brief, selection, editorial, runMeta);
}
