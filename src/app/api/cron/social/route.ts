import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { SOCIAL_ENABLED } from "@/lib/social/config";
import {
  createInstagramContainer,
  publishInstagramContainer,
  publishInstagramCarousel,
  postToFacebook,
} from "@/lib/social/meta";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL not configured." }, { status: 503 });
  }

  const now = new Date();
  const pendingPosts = await db.scheduledPost.findMany({
    where: {
      status: "pending",
      OR: [
        { scheduledFor: null },
        { scheduledFor: { lte: now } },
      ],
    },
    take: 20,
    orderBy: { scheduledFor: "asc" },
  });

  if (!pendingPosts.length) {
    return NextResponse.json({ ok: true, processed: 0, message: "No posts due." });
  }

  const results: { id: string; status: string; error?: string }[] = [];

  for (const post of pendingPosts) {
    const platform = post.platform as "instagram" | "facebook" | "both";
    const fullCaption = post.hashtags ? `${post.caption}\n\n${post.hashtags}` : post.caption;

    // Skip if credentials not yet configured
    const needsIg = platform === "instagram" || platform === "both";
    const needsFb = platform === "facebook" || platform === "both";
    if ((needsIg && !SOCIAL_ENABLED.instagram) || (needsFb && !SOCIAL_ENABLED.facebook)) {
      results.push({ id: post.id, status: "skipped", error: "Credentials not configured." });
      continue;
    }

    // Resolve asset URLs
    const assetUrls: string[] = [];
    if (post.mediaAssetIds.length > 0) {
      const assets = await db.asset.findMany({
        where: { id: { in: post.mediaAssetIds } },
        select: { id: true, secureUrl: true },
      });
      for (const id of post.mediaAssetIds) {
        const asset = assets.find((a) => a.id === id);
        if (asset?.secureUrl) assetUrls.push(asset.secureUrl);
      }
    }

    const firstImageUrl = assetUrls[0];
    const postIds: string[] = [];

    try {
      if (needsIg) {
        let igPostId: string;
        if (assetUrls.length > 1) {
          const result = await publishInstagramCarousel(assetUrls, fullCaption);
          igPostId = result.id ?? "";
        } else if (firstImageUrl) {
          const container = await createInstagramContainer(firstImageUrl, fullCaption);
          if (!container.id) throw new Error(`IG container error: ${container.error?.message}`);
          const published = await publishInstagramContainer(container.id);
          igPostId = published.id ?? "";
        } else {
          throw new Error("Instagram post requires at least one image.");
        }
        postIds.push(igPostId);
      }

      if (needsFb) {
        const result = await postToFacebook(fullCaption, firstImageUrl);
        postIds.push(result.id ?? "");
      }

      await db.scheduledPost.update({
        where: { id: post.id },
        data: { status: "posted", postedAt: now, postId: postIds.join(",") },
      });
      results.push({ id: post.id, status: "posted" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error.";
      await db.scheduledPost.update({
        where: { id: post.id },
        data: { status: "failed", errorMessage: message },
      });
      results.push({ id: post.id, status: "failed", error: message });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
