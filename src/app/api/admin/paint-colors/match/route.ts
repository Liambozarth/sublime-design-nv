import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApiSession, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/db";
import { matchesForSurface, type PaintColorRow } from "@/lib/colorMatch";

const PAINT_COLOR_SELECT = {
  id: true,
  brand: true,
  name: true,
  code: true,
  hex: true,
  r: true,
  g: true,
  b: true,
} as const;

// GET /api/admin/paint-colors/match?hex=AABBCC&surface=wall
// Admin-guarded. Returns { paints: top3, stains: top2, referenceOnly } for the given hex.
export async function GET(request: NextRequest) {
  if (!(await requireAdminApiSession())) return unauthorizedResponse();

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL is not configured." },
      { status: 503 },
    );
  }

  const rawHex = request.nextUrl.searchParams.get("hex")?.trim() ?? "";
  const hex = rawHex.startsWith("#") ? rawHex : `#${rawHex}`;
  if (!/^#[0-9a-fA-F]{3,8}$/.test(hex)) {
    return NextResponse.json(
      { ok: false, error: "A valid hex is required (e.g. ?hex=AABBCC)." },
      { status: 400 },
    );
  }
  const surface = request.nextUrl.searchParams.get("surface") ?? "other";

  const paintRows = (await db.paintColor.findMany({
    select: PAINT_COLOR_SELECT,
  })) as PaintColorRow[];

  const matches = matchesForSurface(hex, surface, paintRows);
  return NextResponse.json({ ok: true, hex, surface, matches });
}
