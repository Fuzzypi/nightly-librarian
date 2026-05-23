"use strict";

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function nonEmptyLines(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function humanJoin(items) {
  if (!items.length) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function splitSectionBlocks(sectionText, pattern) {
  return sectionText
    .split(new RegExp(`\\n(?=${pattern.source})`, pattern.flags))
    .map((block) => block.trim())
    .filter(Boolean);
}

function parseDailyWorthAttention(sectionText) {
  const blocks = splitSectionBlocks(sectionText, /^- \*\*/m);
  return blocks.map((block) => {
    const lines = nonEmptyLines(block);
    const titleMatch = lines[0]?.match(/^- \*\*(.+?)\*\*$/);
    const title = stringValue(titleMatch?.[1]) || "(untitled)";

    let url = "";
    let summaryLines = [];
    for (const line of lines.slice(1)) {
      if (!url && /^https?:\/\//.test(line)) {
        url = line;
      } else {
        summaryLines.push(line);
      }
    }

    return {
      title,
      url,
      summary: summaryLines.join(" ").trim(),
    };
  });
}

function parseDailyFullDigest(sectionText) {
  return nonEmptyLines(sectionText)
    .filter((line) => line.startsWith("- ["))
    .map((line) => {
      const match = line.match(/^- \[([PMR])\]\s+(?:\[([^\]]+)\]\s+)?(.+)$/);
      if (!match) {
        return {
          tag: "R",
          source: "",
          title: line.replace(/^- /, ""),
          url: "",
          summary: "",
        };
      }

      const [, tag, source = "", remainder] = match;
      const segments = remainder.split(" — ").map((part) => part.trim()).filter(Boolean);
      const title = segments.shift() || "(untitled)";

      let url = "";
      if (segments[0] && /^https?:\/\//.test(segments[0])) {
        url = segments.shift();
      }

      return {
        tag,
        source,
        title,
        url,
        summary: segments.join(" — "),
      };
    });
}

function buildDailySummary(report) {
  const highlights = report.worthAttention.slice(0, 3).map((item) => item.title);
  const stats = [
    report.worthAttention.length
      ? `${report.worthAttention.length} worth-attention item${report.worthAttention.length === 1 ? "" : "s"}`
      : "No curated worth-attention items",
    `${report.fullDigest.length} digest line${report.fullDigest.length === 1 ? "" : "s"}`,
  ];

  const text = report.worthAttention.length
    ? `${report.worthAttention.length} stories cleared the bar, led by ${humanJoin(highlights)}.`
    : `This report logged ${report.fullDigest.length} researched items but did not promote any of them into the curated top section.`;

  return { text, highlights, stats };
}

function parseDailyReportMarkdown(markdown, date) {
  const lines = markdown.split("\n");
  const sections = {};
  let currentSection = "_preamble";
  let sectionLines = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      sections[currentSection] = sectionLines.join("\n");
      currentSection = line.replace(/^## /, "").trim().toLowerCase();
      sectionLines = [];
    } else {
      sectionLines.push(line);
    }
  }
  sections[currentSection] = sectionLines.join("\n");

  const preambleLines = nonEmptyLines(sections._preamble || "");
  const titleLine = preambleLines.find((line) => line.startsWith("# "));
  const runLine = preambleLines.find((line) => line.startsWith("Run: "));
  const startedLine = preambleLines.find((line) => line.startsWith("Started: "));
  const completedLine = preambleLines.find((line) => line.startsWith("Completed: "));

  const report = {
    kind: "daily-report",
    slug: date,
    date,
    title: stringValue(titleLine?.replace(/^# /, "")) || "Nightly Librarian — Newsletter draft",
    runId: stringValue(runLine?.replace(/^Run: /, "")),
    startedAt: stringValue(startedLine?.replace(/^Started: /, "")),
    completedAt: stringValue(completedLine?.replace(/^Completed: /, "")),
    worthAttention: parseDailyWorthAttention(sections["worth attention"] || ""),
    fullDigest: parseDailyFullDigest(sections["full digest"] || ""),
    rawMarkdown: markdown.trim(),
  };

  report.summary = buildDailySummary(report);
  return report;
}

function parseLegacySignals(sectionText) {
  const blocks = splitSectionBlocks(sectionText, /^\d+\.\s+/m);
  return blocks.map((block) => {
    const lines = nonEmptyLines(block);
    const title = lines[0]?.replace(/^\d+\.\s+/, "").trim() || "(untitled)";
    return {
      title,
      body: lines.slice(1).join(" ").trim(),
    };
  });
}

function parseLegacySection(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`───\\s+${escaped}[^\\n]*\\n([\\s\\S]*?)(?=\\n───\\s+[^\\n]*\\n|$)`, "i");
  const match = text.match(pattern);
  return match ? match[1].trim() : "";
}

function cleanLegacySection(sectionText) {
  return stringValue(sectionText.split(/\n{2,}═{6,}/)[0]);
}

function buildLegacySummary(report) {
  const highlights = report.signals.slice(0, 3).map((item) => item.title);
  const stats = [
    `${report.signals.length} signal${report.signals.length === 1 ? "" : "s"}`,
    report.issue ? report.issue : "Legacy archive",
  ];

  let text = report.signals.length
    ? `${report.issue || "Legacy issue"} tracked ${report.signals.length} signals, led by ${humanJoin(highlights)}.`
    : `${report.issue || "Legacy issue"} has archived content but no structured signal list could be recovered.`;

  if (report.verdict) {
    text += ` ${report.verdict}`;
  }

  return { text, highlights, stats };
}

function parseLegacyReportMarkdown(markdown, slug) {
  const trimmed = markdown.trim();
  if (!trimmed) return null;

  const lines = nonEmptyLines(trimmed);
  const dateLine = lines.find((line) => /^\d{4}-\d{2}-\d{2}\s+—\s+Issue/.test(line)) || "";
  const dateMatch = dateLine.match(/^(\d{4}-\d{2}-\d{2})\s+—\s+(Issue\s+#\d+)/);
  const date = stringValue(dateMatch?.[1]) || slug.slice(0, 10);
  const issue = stringValue(dateMatch?.[2]);
  const signals = parseLegacySignals(parseLegacySection(trimmed, "THE 5 SIGNALS"));
  const tryThis = cleanLegacySection(parseLegacySection(trimmed, "TRY THIS"));
  const verdict = cleanLegacySection(parseLegacySection(trimmed, "LIBRARIAN'S VERDICT"));

  const report = {
    kind: "legacy-report",
    slug,
    date,
    issue,
    title: "The Nightly Librarian",
    signals,
    tryThis,
    verdict,
    rawMarkdown: trimmed,
  };

  report.summary = buildLegacySummary(report);
  return report;
}

module.exports = {
  parseDailyReportMarkdown,
  parseLegacyReportMarkdown,
};
