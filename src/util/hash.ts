import { createHash } from "crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function candidateId(sourceId: string, title: string, publishedAt: string): string {
  const dateStr = new Date(publishedAt).toDateString();
  return sha256(`${sourceId}|${title}|${dateStr}`);
}
