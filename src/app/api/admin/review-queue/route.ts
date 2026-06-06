import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApiSession, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/db";

// Insert a Cloudinary transformation (~800px) into a secure delivery URL.
// secureUrl shape: https://res.cloudinary.com/<cloud>/image/upload/v123/<publicId>.<ext>
function buildThumbnailUrl(secureUrl: string): string {
  const marker = "/upload/";
  const idx = secureUrl.indexOf(marker);
  if (idx === -1) return secureUrl;
  const transform = "f_auto,q_auto,w_800,c_fit/";
  const head = secureUrl.slice(0, idx + marker.length);
  const tail = secureUrl.slice(idx + marker.length);
  return `${head}${transform}${tail}`;
}

const REVIEW_SELECT = {
  id: true,
  publicId: true,
  secureUrl: true,
  width: true,
  height: true,
  title: true,
  alt: true,
  description: true,
  primaryServiceSlug: true,
  serviceMetadata: true,
  aiSuggestions: true,
  areaSlug: true,
  exifTakenAt: true,
  gpsLat: true,
  gpsLng: true,
  uploadBatchId: true,
  createdAt: true,
} as const;

// GET /api/admin/review-queue
// Admin-guarded. Returns PENDING image assets, oldest first, plus pendingCount.
// GPS fields are returned here ONLY because this endpoint is admin-session-guarded.
// Pass ?count=1 for just the pending count (used by the sidebar badge).
export async function GET(request: NextRequest) {
  if (!(await requireAdminApiSession())) return unauthorizedResponse();

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL is not configured." },
      { status: 503 },
    );
  }

  const pendingCount = await db.asset.count({
    where: { reviewStatus: "PENDING", kind: "IMAGE" },
  });

  if (request.nextUrl.searchParams.get("count") === "1") {
    return NextResponse.json({ ok: true, pendingCount });
  }

  const assets = await db.asset.findMany({
    where: { reviewStatus: "PENDING", kind: "IMAGE" },
    orderBy: { createdAt: "asc" },
    select: REVIEW_SELECT,
  });

  const queue = assets.map((asset) => ({
    ...asset,
    thumbnailUrl: asset.secureUrl ? buildThumbnailUrl(asset.secureUrl) : null,
  }));

  return NextResponse.json({ ok: true, pendingCount, assets: queue });
}
