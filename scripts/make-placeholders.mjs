#!/usr/bin/env node
/**
 * make-placeholders.mjs — generate SVG placeholder images for the site.
 *
 * Usage (from the project root):
 *   node scripts/make-placeholders.mjs               # (re)write SVGs in images/placeholders/
 *   node scripts/make-placeholders.mjs --write-data  # ALSO overwrite js/photos.js with placeholder entries
 *
 * No npm dependencies. Output is deterministic (seeded), so re-running produces identical files.
 * WARNING: --write-data replaces js/photos.js entirely. Don't use it once you've added real photos.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "images", "placeholders");
const writeData = process.argv.includes("--write-data");

// Deterministic PRNG (mulberry32) so layouts are stable between runs.
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260928);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

// Aspect ratios (weighted: landscape 3:2 most common, like a real camera roll).
const RATIOS = [
  { name: "3:2", w: 1500, h: 1000 },
  { name: "3:2", w: 1500, h: 1000 },
  { name: "3:2", w: 1500, h: 1000 },
  { name: "2:3", w: 1000, h: 1500 },
  { name: "2:3", w: 1000, h: 1500 },
  { name: "4:5", w: 1200, h: 1500 },
  { name: "16:9", w: 1600, h: 900 },
  { name: "1:1", w: 1200, h: 1200 },
];

// Soft greys and muted teals.
const PALETTE = [
  ["#dde5e4", "#c3d3d1"],
  ["#d3dbdf", "#b8c5ca"],
  ["#cddfd9", "#a9c7bf"],
  ["#e2e7e9", "#c9d1d4"],
  ["#c2d6d2", "#9dbab4"],
  ["#d8e1de", "#bccbc7"],
  ["#c9d6dc", "#a8bcc4"],
  ["#e3e8e5", "#cbd4cf"],
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function photoSvg(w, h, label, ratioName, [c1, c2]) {
  const s = Math.min(w, h);
  const cx = w / 2;
  const cy = h / 2 - s * 0.06;
  const m = s * 0.16; // motif size
  const fs = Math.round(s * 0.055);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<g fill="#ffffff" fill-opacity="0.55">
<circle cx="${cx + m * 0.55}" cy="${cy - m * 0.45}" r="${m * 0.22}"/>
<path d="M${cx - m} ${cy + m * 0.6} L${cx - m * 0.3} ${cy - m * 0.25} L${cx + m * 0.05} ${cy + m * 0.2} L${cx + m * 0.4} ${cy - m * 0.05} L${cx + m} ${cy + m * 0.6} Z"/>
</g>
<text x="${cx}" y="${cy + m * 0.6 + fs * 1.8}" text-anchor="middle" font-family="Lato, Helvetica, Arial, sans-serif" font-size="${fs}" fill="#46585c" fill-opacity="0.85" letter-spacing="${fs * 0.08}">${esc(label)}</text>
<text x="${cx}" y="${cy + m * 0.6 + fs * 3.1}" text-anchor="middle" font-family="Lato, Helvetica, Arial, sans-serif" font-size="${Math.round(fs * 0.6)}" fill="#46585c" fill-opacity="0.6">${ratioName} placeholder</text>
</svg>
`;
}

function heroSvg() {
  const w = 2400,
    h = 1350;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5f7b7e"/><stop offset="0.6" stop-color="#9bb2b1"/><stop offset="1" stop-color="#c9d6d4"/></linearGradient>
<linearGradient id="mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.35"/></linearGradient>
</defs>
<rect width="${w}" height="${h}" fill="url(#sky)"/>
<path d="M0 820 L260 620 L470 760 L760 480 L1020 700 L1250 560 L1480 720 L1760 470 L2050 690 L2400 540 L2400 1350 L0 1350 Z" fill="#6d8889" fill-opacity="0.75"/>
<rect y="600" width="${w}" height="400" fill="url(#mist)"/>
<path d="M0 980 L320 800 L600 930 L900 760 L1200 900 L1500 780 L1850 940 L2150 820 L2400 900 L2400 1350 L0 1350 Z" fill="#4e6a6c"/>
<path d="M0 1130 L400 1000 L800 1100 L1200 990 L1600 1110 L2000 1010 L2400 1090 L2400 1350 L0 1350 Z" fill="#3b5557"/>
</svg>
`;
}

function headshotSvg() {
  const s = 800;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dfe8e6"/><stop offset="1" stop-color="#bfd1ce"/></linearGradient></defs>
<rect width="${s}" height="${s}" fill="url(#g)"/>
<g fill="#ffffff" fill-opacity="0.75">
<circle cx="400" cy="320" r="130"/>
<path d="M150 800 C150 600 260 500 400 500 C540 500 650 600 650 800 Z"/>
</g>
<text x="400" y="760" text-anchor="middle" font-family="Lato, Helvetica, Arial, sans-serif" font-size="36" fill="#46585c" fill-opacity="0.8" letter-spacing="3">HEADSHOT</text>
</svg>
`;
}

function write(rel, content) {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}

// ---- Single images ---------------------------------------------------------
write("hero.svg", heroSvg());
write("headshot.svg", headshotSvg());
for (const [slug, label] of [
  ["japan", "Japan"],
  ["colombia", "Colombia"],
  ["halifax", "Halifax"],
  ["banff", "Banff"],
]) {
  write(`covers/${slug}.svg`, photoSvg(1500, 1000, `${label} cover`, "3:2", pick(PALETTE)));
}

// ---- Gallery sets ----------------------------------------------------------
function makeSet(folder, label, count) {
  const photos = [];
  for (let i = 1; i <= count; i++) {
    const r = pick(RATIOS);
    const file = `${String(i).padStart(2, "0")}.svg`;
    write(`${folder}/${file}`, photoSvg(r.w, r.h, `${label} ${i}`, r.name, pick(PALETTE)));
    photos.push({
      src: `images/placeholders/${folder}/${file}`,
      width: r.w,
      height: r.h,
      alt: `Placeholder — ${label} photo ${i}`,
    });
  }
  return photos;
}

const data = {
  portfolio: makeSet("portfolio", "Portfolio", 12),
  japan: {
    title: "Japan",
    subtitle: "Tokyo, Osaka, Kyoto, Nara (May 2023)",
    sections: [
      { name: "Tokyo", photos: makeSet("tokyo", "Tokyo", 19) },
      { name: "Osaka and Nara", photos: makeSet("osaka-nara", "Osaka and Nara", 70) },
      { name: "Kyoto", photos: makeSet("kyoto", "Kyoto", 47) },
    ],
  },
  colombia: {
    title: "Colombia",
    subtitle: "Cartagena, Medellin, Bogota (Dec. 2022)",
    sections: [{ name: "", photos: makeSet("colombia", "Colombia", 29) }],
  },
};

const n =
  data.portfolio.length +
  data.japan.sections.reduce((a, s) => a + s.photos.length, 0) +
  data.colombia.sections[0].photos.length;
console.log(
  `Wrote ${n} gallery placeholders + hero, headshot and 4 covers to images/placeholders/`,
);

if (writeData) {
  const js = `/**
 * Photo data for all galleries. Rendered by js/gallery.js.
 *
 * Each photo: { src, thumb (optional), width, height, alt, caption (optional) }
 *   - Paths are relative to the SITE ROOT (e.g. "images/japan/kyoto/IMG_0012.jpg"),
 *     even for pages inside trips/ — gallery.js resolves them for you.
 *   - width/height are the real pixel dimensions (only the ratio matters) so the
 *     layout is computed before images load (no layout shift).
 *
 * A gallery key is either an array of photos (like "portfolio") or a trip:
 *   { title, subtitle, sections: [{ name, photos: [...] }] }
 * Pages reference it with: <div class="gallery" data-gallery="japan" data-section="0"></div>
 *
 * The entries below are PLACEHOLDERS generated by scripts/make-placeholders.mjs.
 * Replace them with real photos (see README → "Adding photos").
 */
window.PHOTO_DATA = {
  portfolio: [
${data.portfolio.map((p) => `    ${JSON.stringify(p)},`).join("\n")}
  ],

  japan: {
    title: ${JSON.stringify(data.japan.title)},
    subtitle: ${JSON.stringify(data.japan.subtitle)},
    sections: [
${data.japan.sections
  .map(
    (s) => `      {
        name: ${JSON.stringify(s.name)},
        photos: [
${s.photos.map((p) => `          ${JSON.stringify(p)},`).join("\n")}
        ],
      },`,
  )
  .join("\n")}
    ],
  },

  colombia: {
    title: ${JSON.stringify(data.colombia.title)},
    subtitle: ${JSON.stringify(data.colombia.subtitle)},
    sections: [
      {
        name: "",
        photos: [
${data.colombia.sections[0].photos.map((p) => `          ${JSON.stringify(p)},`).join("\n")}
        ],
      },
    ],
  },
};
`;
  writeFileSync(join(ROOT, "js", "photos.js"), js);
  console.log("Wrote js/photos.js (placeholder data).");
} else {
  console.log("Tip: pass --write-data to also regenerate js/photos.js (overwrites it!).");
}
