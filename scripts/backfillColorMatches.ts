// One-off: enrich stored aiSuggestions.dominantColors of PENDING assets with paint/stain
// matches, without re-running vision. Idempotent — skips colors that already have matches.
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
import { matchesForSurface, type PaintColorRow } from "@/lib/colorMatch";

dotenv.config({ path: ".env.local" });

type DominantColor = { hex?: string; surface?: string; matches?: unknown };

async function main() {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const paintRows = (await db.paintColor.findMany({
    select: { id: true, brand: true, name: true, code: true, hex: true, r: true, g: true, b: true },
  })) as PaintColorRow[];
  console.log(`loaded ${paintRows.length} paint colors`);

  const assets = await db.asset.findMany({
    where: { reviewStatus: "PENDING", kind: "IMAGE" },
    select: { id: true, publicId: true, aiSuggestions: true },
  });
  console.log(`PENDING assets: ${assets.length}`);

  let updated = 0;
  for (const a of assets) {
    const ai = a.aiSuggestions as { dominantColors?: DominantColor[] } | null;
    if (!ai || !Array.isArray(ai.dominantColors) || ai.dominantColors.length === 0) {
      console.log(`  skip ${a.publicId} (no dominantColors)`);
      continue;
    }
    let changed = false;
    const enriched = ai.dominantColors.map((c) => {
      if (!c.hex) return c;
      if (c.matches) return c; // already enriched
      changed = true;
      return { ...c, surface: c.surface ?? "other", matches: matchesForSurface(c.hex, c.surface ?? "other", paintRows) };
    });
    if (!changed) {
      console.log(`  skip ${a.publicId} (already enriched)`);
      continue;
    }
    await db.asset.update({
      where: { id: a.id },
      data: {
        aiSuggestions: { ...ai, dominantColors: enriched } as unknown as Prisma.InputJsonValue,
      },
    });
    updated++;
    console.log(`  enriched ${a.publicId} (${enriched.length} colors)`);
  }

  console.log(`\nDone. Updated ${updated} asset(s).`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error("ERR", e instanceof Error ? e.message : e);
  process.exit(1);
});
