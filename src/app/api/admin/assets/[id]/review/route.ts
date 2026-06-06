import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApiSession, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/db";
import { findContext } from "@/content/contexts";
import { findArea } from "@/content/areas";
import {
  buildAssetTagDefinitions,
  isServiceTagSlug,
  normalizeContextTagSlugs,
  normalizeServiceTagSlugs,
} from "@/lib/serviceTags";
import { buildAssetAltText, validateServiceAssetMetadata } from "@/lib/serviceAssetMetadata";

type Params = { params: { id: string } };

type ReviewFields = {
  title?: string;
  alt?: string;
  description?: string;
  primaryServiceSlug?: string;
  secondaryServiceSlugs?: string[];
  contextSlugs?: string[];
  serviceMetadata?: unknown;
  areaSlug?: string | null;
  location?: string | null;
};

type ReviewBody = {
  action?: "approve" | "reject";
  fields?: ReviewFields;
  publish?: boolean;
};

// POST /api/admin/assets/[id]/review
// Admin-guarded. Approve (apply edited suggestion fields + tags, publish) or reject.
export async function POST(request: NextRequest, { params }: Params) {
  if (!(await requireAdminApiSession())) return unauthorizedResponse();

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL is not configured." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as ReviewBody;

  const existing = await db.asset.findUnique({
    where: { id: params.id },
    select: { id: true, kind: true },
  });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Asset not found" }, { status: 404 });
  }

  // ── Reject: flip status, unpublish, touch nothing else ──
  if (body.action === "reject") {
    await db.asset.update({
      where: { id: params.id },
      data: { reviewStatus: "REJECTED", published: false },
    });
    return NextResponse.json({ ok: true, action: "reject" });
  }

  if (body.action !== "approve") {
    return NextResponse.json(
      { ok: false, error: "action must be 'approve' or 'reject'." },
      { status: 400 },
    );
  }

  // ── Approve: validate + apply edited fields ──
  const fields = body.fields ?? {};

  const title = fields.title?.trim();
  if (!title) {
    return NextResponse.json(
      { ok: false, error: "title is required to approve." },
      { status: 400 },
    );
  }

  const primaryServiceSlug = fields.primaryServiceSlug?.trim();
  if (!primaryServiceSlug || !isServiceTagSlug(primaryServiceSlug)) {
    return NextResponse.json(
      { ok: false, error: "A valid primary service is required." },
      { status: 400 },
    );
  }

  const metadataValidation = validateServiceAssetMetadata(
    primaryServiceSlug,
    fields.serviceMetadata,
  );
  if (!metadataValidation.ok) {
    return NextResponse.json(
      { ok: false, error: metadataValidation.errors.join(" ") },
      { status: 400 },
    );
  }

  const invalidContexts = (fields.contextSlugs ?? []).filter((slug) => !findContext(slug));
  if (invalidContexts.length > 0) {
    return NextResponse.json(
      { ok: false, error: `Invalid context slugs: ${invalidContexts.join(", ")}` },
      { status: 400 },
    );
  }

  const serviceSlugs = normalizeServiceTagSlugs([
    primaryServiceSlug,
    ...(fields.secondaryServiceSlugs ?? []),
  ]);
  const contextSlugs = normalizeContextTagSlugs(fields.contextSlugs);

  // areaSlug: explicit wins; null clears
  const areaSlug = fields.areaSlug?.trim() || null;
  // location label: explicit wins, else derive from area name
  const location =
    fields.location?.trim() ||
    (areaSlug ? findArea(areaSlug)?.name ?? null : null);

  const description = fields.description?.trim() || null;
  const alt =
    fields.alt?.trim() || buildAssetAltText({ title, location, primaryServiceSlug });
  const published = body.publish ?? true;

  try {
    const asset = await db.$transaction(async (tx) => {
      const tagDefinitions = buildAssetTagDefinitions({ serviceSlugs, contextSlugs });

      const tagRecords = await Promise.all(
        tagDefinitions.map((tag) =>
          tx.serviceType.upsert({
            where: { slug_tagType: { slug: tag.slug, tagType: tag.tagType } },
            update: { title: tag.title },
            create: { slug: tag.slug, title: tag.title, tagType: tag.tagType },
            select: { id: true },
          }),
        ),
      );

      // Replace existing tag rows with the reviewed set.
      await tx.assetTag.deleteMany({ where: { assetId: params.id } });

      return tx.asset.update({
        where: { id: params.id },
        data: {
          title,
          alt,
          description,
          primaryServiceSlug,
          serviceMetadata: metadataValidation.data as Prisma.InputJsonValue,
          location,
          areaSlug,
          reviewStatus: "APPROVED",
          published,
          tags: {
            create: tagRecords.map((tag) => ({ serviceTypeId: tag.id })),
          },
        },
        select: { id: true, reviewStatus: true, published: true, title: true },
      });
    });

    return NextResponse.json({ ok: true, action: "approve", asset });
  } catch (error) {
    console.error(
      "[assets/review] approve failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: false, error: "Failed to approve asset." },
      { status: 500 },
    );
  }
}
