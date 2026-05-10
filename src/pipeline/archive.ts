import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { RawItem, CandidateSignal, ScoredCandidate, Selection, GateReport, PipelineRun } from "../types.ts";
import { runTimestamp } from "../util/date.ts";

const ARCHIVE_DIR = join(import.meta.dir, "..", "..", "archive", "runs");

export interface ArchiveData {
  runMeta: PipelineRun;
  rawItems: RawItem[];
  candidates: CandidateSignal[];
  scored: ScoredCandidate[];
  selection: Selection;
  memo: string;
  brief: string;
  gateReport: GateReport;
}

export function writeArchive(data: ArchiveData, timestamp?: string): string {
  const ts = timestamp ?? runTimestamp();
  const runDir = join(ARCHIVE_DIR, ts);
  mkdirSync(runDir, { recursive: true });

  writeFileSync(join(runDir, "run.json"), JSON.stringify(data.runMeta, null, 2));
  writeFileSync(join(runDir, "raw-items.json"), JSON.stringify(data.rawItems, null, 2));
  writeFileSync(join(runDir, "candidates.json"), JSON.stringify(data.candidates, null, 2));
  writeFileSync(join(runDir, "scored.json"), JSON.stringify(data.scored, null, 2));
  writeFileSync(join(runDir, "selection.json"), JSON.stringify(data.selection, null, 2));
  writeFileSync(join(runDir, "memo.md"), data.memo);
  writeFileSync(join(runDir, "brief.md"), data.brief);
  writeFileSync(join(runDir, "gates.json"), JSON.stringify(data.gateReport, null, 2));

  return runDir;
}

export function getArchiveDir(): string {
  return ARCHIVE_DIR;
}
