// One-off: generate PWA icons from the brand logo into public/icons/.
// Background: WHITE (the logo art is dark/neutral on transparent — legible on white;
// navy would wash out the darker strokes). Maskable uses a 12% safe-zone (>10%).
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(process.cwd(), "public/images/logo-dark.png");
const OUT_DIR = path.join(process.cwd(), "public/icons");
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

async function make(size: number, padFraction: number, outFile: string) {
  const inner = Math.round(size * (1 - padFraction * 2));
  const logo = await sharp(SRC)
    .resize(inner, inner, { fit: "contain", background: WHITE })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(path.join(OUT_DIR, outFile));
  console.log(`  wrote ${outFile} (${size}px, pad ${Math.round(padFraction * 100)}%)`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log("Generating PWA icons (white background):");
  await make(192, 0.08, "icon-192.png");
  await make(512, 0.08, "icon-512.png");
  await make(512, 0.12, "icon-512-maskable.png");
  await make(180, 0.1, "apple-touch-icon.png");
  console.log("Done.");
}

main().catch((e) => {
  console.error("ERR", e instanceof Error ? e.message : e);
  process.exit(1);
});
