import { NextResponse } from "next/server";
import { requireAdminApiSession, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/db";

// Insert a small Cloudinary transformation for map pin thumbnails.
function thumb(secureUrl: string, width: number): string {
  const marker = "/upload/";
  const idx = secureUrl.indexOf(marker);
  if (idx === -1) return secureUrl;
  return `${secureUrl.slice(0, idx + marker.length)}f_auto,q_auto,w_${width},c_fill/${secureUrl.slice(idx + marker.length)}`;
}

// GET /api/admin/assets/geo
// Admin-guarded. All assets that carry GPS, for the admin photo map. GPS is admin-only.
export async function GET() {
  if (!(await requireAdminApiSession())) return unauthorizedResponse();

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL is not configured." },
      { status: 503 },
    );
  }

  const assets = await db.asset.findMany({
    where: { gpsLat: { not: null }, gpsLng: { not: null } },
    select: {
      id: true,
      secureUrl: true,
      title: true,
      areaSlug: true,
      reviewStatus: true,
      published: true,
      exifTakenAt: true,
      gpsLat: true,
      gpsLng: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const points = assets.map((a) => ({
    id: a.id,
    thumbnailUrl: a.secureUrl ? thumb(a.secureUrl, 200) : null,
    title: a.title,
    areaSlug: a.areaSlug,
    reviewStatus: a.reviewStatus,
    published: a.published,
    exifTakenAt: a.exifTakenAt,
    lat: a.gpsLat,
    lng: a.gpsLng,
  }));

  return NextResponse.json({ ok: true, count: points.length, points });
}
