#!/usr/bin/env node
/**
 * check-links.mjs — find broken internal links, asset paths, #anchors and photo paths.
 * Usage: node scripts/check-links.mjs     (exit code 1 if anything is broken)
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
const SKIP = new Set(["node_modules", ".git", ".vscode"]);
const problems = [];

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    if (SKIP.has(f)) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith(".html")) out.push(p);
  }
  return out;
}

const idsCache = new Map();
function idsIn(file) {
  if (!idsCache.has(file)) {
    const html = readFileSync(file, "utf8");
    idsCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return idsCache.get(file);
}

const pages = walk(ROOT);
let checked = 0;
for (const page of pages) {
  const html = readFileSync(page, "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const refs = [...html.matchAll(/\s(?:href|src)="([^"]*)"/g)].map((m) => m[1]);
  // url(...) inside inline styles
  for (const m of html.matchAll(/url\(["']?([^"')]+)["']?\)/g)) refs.push(m[1]);
  for (const ref of refs) {
    if (!ref || /^(https?:|mailto:|tel:|data:|\/\/)/i.test(ref)) continue;
    checked++;
    const [pathPart, hash] = ref.split("#");
    const target = pathPart ? resolve(dirname(page), pathPart.split("?")[0]) : page;
    const rel = relative(ROOT, page);
    if (!existsSync(target)) {
      problems.push(`${rel}: missing file "${ref}"`);
      continue;
    }
    if (hash && target.endsWith(".html") && !idsIn(target).has(hash)) {
      problems.push(`${rel}: missing anchor "#${hash}" in "${ref || rel}"`);
    }
  }
}

// CSS url(...) references
const cssDir = join(ROOT, "css");
if (existsSync(cssDir)) {
  for (const f of readdirSync(cssDir).filter((f) => f.endsWith(".css"))) {
    const css = readFileSync(join(cssDir, f), "utf8");
    for (const m of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      if (/^(https?:|data:)/.test(m[1])) continue;
      checked++;
      if (!existsSync(resolve(cssDir, m[1]))) problems.push(`css/${f}: missing "${m[1]}"`);
    }
  }
}

// Photo data
const photosFile = join(ROOT, "js", "photos.js");
let photoCount = 0;
if (existsSync(photosFile)) {
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync(photosFile, "utf8"), ctx);
  const data = ctx.window.PHOTO_DATA || {};
  const check = (p, where) => {
    photoCount++;
    for (const k of ["src", "thumb"]) {
      if (p[k] && !/^https?:/.test(p[k]) && !existsSync(join(ROOT, p[k]))) {
        problems.push(`js/photos.js (${where}): missing ${k} "${p[k]}"`);
      }
    }
    if (!p.width || !p.height)
      problems.push(`js/photos.js (${where}): "${p.src}" has no width/height`);
    if (!p.alt) problems.push(`js/photos.js (${where}): "${p.src}" has no alt text`);
  };
  for (const [key, val] of Object.entries(data)) {
    const sections = Array.isArray(val)
      ? [{ photos: val }]
      : val.sections || [{ photos: val.photos || [] }];
    sections.forEach((s, i) => (s.photos || []).forEach((p) => check(p, `${key}[${i}]`)));
  }
  // Every data-gallery on a page must exist in the data
  for (const page of pages) {
    const html = readFileSync(page, "utf8");
    for (const m of html.matchAll(/data-gallery="([^"]+)"(?:\s+data-section="(\d+)")?/g)) {
      const entry = data[m[1]];
      const sec = Number(m[2] || 0);
      const ok =
        entry && (Array.isArray(entry) || entry.photos || (entry.sections && entry.sections[sec]));
      if (!ok)
        problems.push(
          `${relative(ROOT, page)}: data-gallery="${m[1]}" section ${sec} not in photos.js`,
        );
    }
  }
}

console.log(
  `Checked ${pages.length} pages, ${checked} internal references, ${photoCount} photo entries.`,
);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):\n  ` + problems.join("\n  "));
  process.exit(1);
}
console.log("No broken internal links. ✓");
