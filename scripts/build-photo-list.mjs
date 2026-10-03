#!/usr/bin/env node
/**
 * build-photo-list.mjs — print js/photos.js entries for a folder of web-sized photos.
 * macOS only (uses the built-in `sips` to read pixel dimensions). No npm dependencies.
 *
 * Usage (from the project root):
 *   node scripts/build-photo-list.mjs images/japan/kyoto --label "Kyoto"
 *
 * Looks for .jpg/.jpeg/.png/.webp/.avif files directly inside the folder (sorted by name).
 * If a matching file exists in <folder>/thumbs/, it is added as "thumb".
 * Prints a JSON array you can paste into the right place in js/photos.js.
 *
 * Options:
 *   --label "Kyoto"      used for alt text: "Kyoto photo 12" (default: folder name)
 *   --out file.json      also write the array to a file
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
const args = process.argv.slice(2);
const folderArg = args.find((a, i) => !a.startsWith("--") && !(args[i - 1] || "").startsWith("--"));
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

if (!folderArg) {
  console.error(
    'Usage: node scripts/build-photo-list.mjs images/<trip>/<section> [--label "Name"] [--out file.json]',
  );
  process.exit(1);
}

const folder = resolve(folderArg);
if (!existsSync(folder)) {
  console.error(`Folder not found: ${folderArg}`);
  process.exit(1);
}
const label = opt("--label") || basename(folder);
const toUrl = (p) => relative(ROOT, p).split(sep).join("/");

function dimensions(file) {
  const out = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file], {
    encoding: "utf8",
  });
  const w = Number((out.match(/pixelWidth:\s*(\d+)/) || [])[1]);
  const h = Number((out.match(/pixelHeight:\s*(\d+)/) || [])[1]);
  if (!w || !h) throw new Error(`Could not read size of ${file}`);
  return { w, h };
}

const files = readdirSync(folder)
  .filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f) && !f.startsWith("."))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (!files.length) {
  console.error(`No images found in ${folderArg}`);
  process.exit(1);
}

const photos = files.map((f, i) => {
  const full = join(folder, f);
  const { w, h } = dimensions(full);
  const entry = { src: toUrl(full) };
  const thumb = join(folder, "thumbs", f);
  if (existsSync(thumb)) entry.thumb = toUrl(thumb);
  Object.assign(entry, { width: w, height: h, alt: `${label} photo ${i + 1}` });
  return entry;
});

const json = "[\n" + photos.map((p) => "  " + JSON.stringify(p)).join(",\n") + "\n]";
console.log(json);
const out = opt("--out");
if (out) {
  writeFileSync(out, json + "\n");
  console.error(`Wrote ${photos.length} entries to ${out}`);
} else {
  console.error(`${photos.length} photos. Paste the array into js/photos.js.`);
}
