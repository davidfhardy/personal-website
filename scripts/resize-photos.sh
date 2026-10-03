#!/usr/bin/env bash
# resize-photos.sh — make web-sized copies of photos using macOS's built-in `sips`.
#
# Usage (from the project root):
#   ./scripts/resize-photos.sh ~/Pictures/Exports/Kyoto images/japan/kyoto
#
# Creates, for every JPEG/PNG/HEIC in SOURCE:
#   DEST/<name>.jpg          long edge 2000px, JPEG quality 80  (lightbox / full view)
#   DEST/thumbs/<name>.jpg   long edge 800px,  JPEG quality 80  (gallery grid)
# Originals are never modified. Then run:
#   node scripts/build-photo-list.mjs DEST --label "Kyoto"
#
# Tip: export from Lightroom/Photos with location data removed if you don't want
# GPS coordinates published (sips keeps most metadata).
set -euo pipefail

SRC="${1:-}"
DEST="${2:-}"
FULL="${FULL_SIZE:-2000}"
THUMB="${THUMB_SIZE:-800}"
QUALITY="${QUALITY:-80}"

if [[ -z "$SRC" || -z "$DEST" ]]; then
  echo "Usage: $0 <source-folder> <dest-folder, e.g. images/japan/kyoto>" >&2
  exit 1
fi
if ! command -v sips >/dev/null 2>&1; then
  echo "This script needs macOS 'sips'." >&2
  exit 1
fi

mkdir -p "$DEST/thumbs"
shopt -s nullglob nocaseglob
count=0
for f in "$SRC"/*.{jpg,jpeg,png,heic,tif,tiff}; do
  name="$(basename "${f%.*}")"
  sips -s format jpeg -s formatOptions "$QUALITY" -Z "$FULL" "$f" --out "$DEST/$name.jpg" >/dev/null
  sips -s format jpeg -s formatOptions "$QUALITY" -Z "$THUMB" "$f" --out "$DEST/thumbs/$name.jpg" >/dev/null
  count=$((count + 1))
  echo "  ✓ $name.jpg"
done
echo "Done: $count photo(s) → $DEST (full ${FULL}px, thumbs ${THUMB}px, quality $QUALITY)"
