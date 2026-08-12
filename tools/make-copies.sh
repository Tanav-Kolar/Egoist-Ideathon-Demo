#!/bin/bash
# Derives the "modified copy" of each sample: resizes to 60%, re-encodes as low-quality
# JPEG, strips EXIF, and renames — so the pHash match beat works on a visibly different
# file. Uses macOS `sips` (zero external deps). Written for bash 3.2 (macOS default has
# no associative arrays), so uses parallel indexed arrays.
#
# Usage: tools/make-copies.sh
set -euo pipefail
cd "$(dirname "$0")/../assets/samples"

SRC_BASES=(studio-rig neon-signage ink-bloom)
OUT_NAMES=(IMG_4471_repost.jpg signage_final_v2.jpg bloom_export.jpg)

i=0
while [ "$i" -lt "${#SRC_BASES[@]}" ]; do
  base="${SRC_BASES[$i]}"
  out="${OUT_NAMES[$i]}"
  src="${base}.jpg"
  [ -f "$src" ] || { echo "missing $src" >&2; exit 1; }

  w=$(sips -g pixelWidth "$src" | awk '/pixelWidth/{print $2}')
  h=$(sips -g pixelHeight "$src" | awk '/pixelHeight/{print $2}')
  nw=$(( w * 60 / 100 ))
  nh=$(( h * 60 / 100 ))

  # resize to 60% and re-encode as JPEG q35 in one pass
  sips -z "$nh" "$nw" -s format jpeg -s formatOptions 35 "$src" --out "$out" >/dev/null
  # strip EXIF (including orientation) so the copy isn't hashed as a rotated image
  sips -d exif -d exifIptc "$out" --out "$out" >/dev/null 2>&1 || true

  echo "$src  ->  $out  (${nw}x${nh}, q35)"
  i=$((i + 1))
done

echo "done."
