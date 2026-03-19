#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(sed -n 's/.*"version": "\(.*\)".*/\1/p' "$ROOT_DIR/manifest.json" | head -n 1)"

if [[ -z "$VERSION" ]]; then
  echo "Could not read version from manifest.json" >&2
  exit 1
fi

PACKAGE_NAME="boss-job-collector-v${VERSION}"
OUTPUT_DIR="$ROOT_DIR/release/$PACKAGE_NAME"
ZIP_PATH="$ROOT_DIR/release/${PACKAGE_NAME}-unpacked.zip"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

cp "$ROOT_DIR/manifest.json" "$OUTPUT_DIR/"
cp "$ROOT_DIR/background.js" "$OUTPUT_DIR/"
cp "$ROOT_DIR/sidepanel.html" "$OUTPUT_DIR/"
cp "$ROOT_DIR/sidepanel.js" "$OUTPUT_DIR/"
cp "$ROOT_DIR/sidepanel.css" "$OUTPUT_DIR/"

if [[ -d "$ROOT_DIR/icons" ]]; then
  cp -R "$ROOT_DIR/icons" "$OUTPUT_DIR/"
fi

rm -f "$ZIP_PATH"
(
  cd "$ROOT_DIR/release"
  zip -qr "${PACKAGE_NAME}-unpacked.zip" "$PACKAGE_NAME"
)

echo "Built:"
echo "  $OUTPUT_DIR"
echo "  $ZIP_PATH"
