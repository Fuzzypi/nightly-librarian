#!/usr/bin/env node
"use strict";

/**
 * og-render.js
 *
 * Renders a unique 1200x630 OG/Twitter-card PNG per brief, baking in the
 * actual date + lead headline instead of reusing one shared image. Pure
 * build-time step — no browser, no network call, deterministic.
 *
 * Uses @resvg/resvg-js (Rust SVG renderer via native binding, prebuilt for
 * common platforms — no headless Chromium). Fonts are bundled as static TTF
 * instances under assets/fonts/ so rendering doesn't depend on whatever
 * fonts happen to be installed on the machine that runs the build.
 *
 * SVG has no built-in text wrapping, so lines are wrapped here using a
 * character-width heuristic (no real font-metrics lookup) — good enough for
 * a headline-sized image, tuned by eye against the bundled fonts.
 */

const fs = require("node:fs");
const path = require("node:path");
const { Resvg } = require("@resvg/resvg-js");

const FONTS_DIR = path.join(__dirname, "..", "assets", "fonts");
const FONT_FILES = [
  path.join(FONTS_DIR, "Fraunces-Black.ttf"),
  path.join(FONTS_DIR, "Fraunces-Bold.ttf"),
  path.join(FONTS_DIR, "Inter-Bold.ttf"),
  path.join(FONTS_DIR, "Inter-SemiBold.ttf"),
].filter((f) => fs.existsSync(f));

const W = 1200;
const H = 630;
const MARGIN = 74;

const BG = "#f9f6f0";
const TEXT = "#1a1a18";
const TEXT_DIM = "#6a6860";
const ACCENT = "#1e7a42";
const RULE = "#dcd6c8";

function escXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function spaced(str) {
  return String(str).split("").join("  ");
}

/**
 * Greedy word-wrap using a character-width heuristic (no real font metrics
 * available on the JS side pre-render). avgCharEm is the assumed average
 * glyph advance width as a fraction of font-size, tuned by eye for the
 * bundled Fraunces Black.
 */
function wrapToFit(text, maxWidthPx, { startSize = 76, minSize = 42, step = 4, maxLines = 3, avgCharEm = 0.58 } = {}) {
  const words = text.split(/\s+/).filter(Boolean);
  let best = null;

  for (let size = startSize; size >= minSize; size -= step) {
    const maxChars = Math.max(6, Math.floor(maxWidthPx / (size * avgCharEm)));
    const lines = [];
    let cur = "";
    for (const w of words) {
      const trial = cur ? `${cur} ${w}` : w;
      if (trial.length <= maxChars || !cur) {
        cur = trial;
      } else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    best = { lines, size };
    if (lines.length <= maxLines) return best;
  }

  // Still too long at minSize — truncate to maxLines with an ellipsis on the last line.
  const { lines, size } = best;
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, "").trim() + "…";
    return { lines: kept, size };
  }
  return best;
}

/**
 * @param {{ date: string, dateLabel: string, category: string, headline: string }} opts
 * @returns {Buffer} PNG bytes
 */
function renderBriefOgImage({ dateLabel, category, headline }) {
  const maxTextWidth = W - MARGIN * 2;
  const { lines, size } = wrapToFit(headline, maxTextWidth, { startSize: 74, minSize: 42, maxLines: 3 });
  const lineHeight = Math.round(size * 1.22);
  const totalH = lineHeight * lines.length;
  const availableTop = 285;
  const availableBottom = 545;
  let y = availableTop + Math.max(0, Math.floor((availableBottom - availableTop - totalH) / 2)) + size;

  const headlineSvg = lines.map((line) => {
    const el = `<text x="${MARGIN}" y="${y}" font-family="Fraunces Black" font-size="${size}" font-weight="900" fill="${TEXT}">${escXml(line)}</text>`;
    y += lineHeight;
    return el;
  }).join("\n    ");

  const eyebrow = category ? `${category.toUpperCase()} · ${dateLabel.toUpperCase()}` : dateLabel.toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${BG}"/>
    <rect x="0" y="0" width="${W}" height="10" fill="${ACCENT}"/>
    <text x="${MARGIN}" y="94" font-family="Fraunces Bold" font-size="38" font-weight="700" fill="${TEXT}">The Nightly Librarian</text>
    <text x="${MARGIN}" y="122" font-family="Inter SemiBold" font-size="15" font-weight="600" fill="${TEXT_DIM}">${escXml(spaced("AI SIGNAL WITHOUT THE NOISE"))}</text>
    <line x1="${MARGIN}" y1="150" x2="${W - MARGIN}" y2="150" stroke="${RULE}" stroke-width="1"/>
    <text x="${MARGIN}" y="250" font-family="Inter Bold" font-size="19" font-weight="700" fill="${ACCENT}">${escXml(spaced(eyebrow))}</text>
    ${headlineSvg}
    <line x1="${MARGIN}" y1="${H - 70}" x2="${W - MARGIN}" y2="${H - 70}" stroke="${RULE}" stroke-width="1"/>
    <text x="${MARGIN}" y="${H - 50}" font-family="Inter SemiBold" font-size="16" font-weight="600" fill="${TEXT_DIM}">What changed. Why it matters. What to do.</text>
    <text x="${W - MARGIN}" y="${H - 50}" font-family="Inter SemiBold" font-size="16" font-weight="600" fill="${TEXT_DIM}" text-anchor="end">thenightlylibrarian.com</text>
  </svg>`;

  const resvg = new Resvg(svg, {
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: false,
      defaultFontFamily: "Fraunces Black",
    },
  });
  return resvg.render().asPng();
}

module.exports = { renderBriefOgImage, wrapToFit };

// CLI smoke test: node scripts/og-render.js "headline text" "category" "Jul 1, 2026" out.png
if (require.main === module) {
  const [headline, category, dateLabel, outFile] = process.argv.slice(2);
  const png = renderBriefOgImage({
    headline: headline || "Build realtime voice agents on AI Gateway",
    category: category || "Voice AI / Realtime Agents",
    dateLabel: dateLabel || "July 1, 2026",
  });
  fs.writeFileSync(outFile || "/tmp/og-brief-test.png", png);
  console.log("wrote", outFile || "/tmp/og-brief-test.png", png.length, "bytes");
}
