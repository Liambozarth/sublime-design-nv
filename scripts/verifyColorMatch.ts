import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
import { hexToLab, deltaE2000, matchPaintColors, type PaintColorRow } from "@/lib/colorMatch";

dotenv.config({ path: ".env.local" });

async function main() {
  // ── Pure sanity (no DB) ──
  const white = hexToLab("#FFFFFF")!;
  const black = hexToLab("#000000")!;
  const grayA = hexToLab("#AAA294")!;
  console.log("ΔE(white,white) =", deltaE2000(white, white).toFixed(4), "(expect 0)");
  console.log("ΔE(white,black) =", deltaE2000(white, black).toFixed(2), "(expect large, ~100)");
  console.log(
    "symmetry ΔE(a,b)==ΔE(b,a):",
    Math.abs(deltaE2000(white, grayA) - deltaE2000(grayA, white)) < 1e-9,
  );

  // ── DB-backed: #AAA294 should match SW Intellectual Gray with ΔE < 2 ──
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const colors = (await db.paintColor.findMany({
    select: { id: true, brand: true, name: true, code: true, hex: true, r: true, g: true, b: true },
  })) as PaintColorRow[];
  console.log(`\nloaded ${colors.length} paint colors`);

  const top = matchPaintColors("#AAA294", colors, { topN: 5 });
  console.log("\n#AAA294 top 5 matches:");
  for (const m of top) console.log(`  ${m.brand} ${m.code} ${m.name} — ΔE ${m.deltaE}`);

  const intellectualGray = top.find((m) => /intellectual gray/i.test(m.name));
  console.log(
    `\n#AAA294 → SW Intellectual Gray present in top5: ${Boolean(intellectualGray)}` +
      (intellectualGray ? ` (ΔE ${intellectualGray.deltaE}, <2: ${intellectualGray.deltaE < 2})` : ""),
  );

  // White-ish target should match a white with small ΔE
  const whiteTop = matchPaintColors("#FFFFFF", colors, { topN: 3 });
  console.log("\n#FFFFFF top 3 matches:");
  for (const m of whiteTop) console.log(`  ${m.brand} ${m.code} ${m.name} — ΔE ${m.deltaE}`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error("ERR", e instanceof Error ? e.message : e);
  process.exit(1);
});
