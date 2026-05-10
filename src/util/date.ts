export function isWithinWindow(publishedAt: string, windowHours: number, referenceTime?: Date): boolean {
  const ref = referenceTime ?? new Date();
  const published = new Date(publishedAt);
  const cutoff = new Date(ref.getTime() - windowHours * 60 * 60 * 1000);
  return published >= cutoff && published <= ref;
}

export function hoursAgo(isoDate: string, referenceTime?: Date): number {
  const ref = referenceTime ?? new Date();
  const d = new Date(isoDate);
  return (ref.getTime() - d.getTime()) / (1000 * 60 * 60);
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function runTimestamp(date?: Date): string {
  const d = date ?? new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
