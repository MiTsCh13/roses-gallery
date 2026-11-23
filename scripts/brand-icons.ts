// Erzeugt Favicon, Apple-Icon und Logo-PNG aus der Bildmarke (D-161).
// Aufruf nach Änderungen an der Bildmarke: pnpm tsx scripts/brand-icons.ts
import { writeFileSync } from "node:fs";

import sharp from "sharp";

import { brandTileSvg } from "../src/lib/brand-icon";

async function main() {
  writeFileSync("src/app/icon.svg", brandTileSvg() + "\n");
  // iOS rundet selbst ab: volle Fläche ohne Eckradius.
  await sharp(Buffer.from(brandTileSvg(0)))
    .resize(180, 180)
    .png()
    .toFile("src/app/apple-icon.png");
  await sharp(Buffer.from(brandTileSvg()))
    .resize(512, 512)
    .png()
    .toFile("public/logo.png");
}

void main();
