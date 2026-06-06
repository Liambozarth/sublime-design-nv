import { AssetKind, Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { findContext } from "@/content/contexts";
import { requireAdminApiSession, unauthorizedResponse } from "@/lib/auth";
import { findService } from "@/content/services";
import { db } from "@/lib/db";
import { buildCanonicalAssetFields, getAssetTagBuckets } from "@/lib/assetContract";
import {
  buildAssetTagDefinitions,
  isServiceTagSlug,
  normalizeContextTagSlugs,
  normalizeServiceTagSlugs,
} from "@/lib/serviceTags";
import { buildAssetAltText, validateServiceAssetMetadata } from "@/lib/serviceAssetMetadata";
import { nearestAreaSlug } from "@/lib/geo";

type CreateAssetBody = {
  kind?: AssetKind;
  publicId?: string;
  imageUrl?: string;
  secureUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  format?: string;
  bytes?: number;
  alt?: string;
  title?: string;
  description?: string;
  location?: string;
  primaryServiceSlug?: string;
  serviceMetadata?: unknown;
  gpsLat?: number | null;
  gpsLng?: number | null;
  areaSlug?: string | null;
  exifTakenAt?: string | null;
  published?: boolean;
  tagSlugs?: string[];
  contextSlugs?: string[];
  uploadBatchId?: string;
  materials?: string[];
  materialCategoryId?: string;
  assetManufacturerId?: string;
  assetSupplierId?: string;
  assetMaterialId?: string;
  materialSheen?: string;
};

const ASSET_SELECT = {
  id: true,
  kind: true,
  publicId: true,
  secureUrl: true,
  width: true,
  height: true,
  duration: true,
  format: true,
  bytes: true,
  title: true,
  description: true,
  location: true,
  primaryServiceSlug: true,
  serviceMetadata: true,
  alt: true,
  published: true,
  galleryFeature: true,
  isHero: true,
  uploadBatchId: true,
  createdAt: true,
  projectLinks: {
    orderBy: {
      position: "asc",
    },
    select: {
      project: {
        select: {
          id: true,
          slug: true,
          title: true,
        },
      },
    },
  },
  tags: {
    include: {
      serviceType: {
        select: {
          slug: true,
          title: true,
          tagType: true,
        },
      },
    },
  },
} as const;

type AdminAssetRow = Prisma.AssetGetPayload<{ select: typeof ASSET_SELECT }>;

function getDbUnavailableResponse() {
  return NextResponse.json(
    { ok: false, error: "DATABASE_URL is not configured." },
    { status: 503 },
  );
}

function serializeAdminAsset(asset: AdminAssetRow) {
  const tags = asset.tags.map((tag) => ({
    slug: tag.serviceType.slug,
    title: tag.serviceType.title,
    tagType: tag.serviceType.tagType,
  }));
  const { serviceTags, contextTags, contextSlugs } = getAssetTagBuckets(tags);
  const linkedProject = asset.projectLinks[0]?.project ?? null;
  const canonical = buildCanonicalAssetFields({
    kind: asset.kind,
    publicId: asset.publicId,
    secureUrl: asset.secureUrl,
    format: asset.format,
    width: asset.width,
    height: asset.height,
    published: asset.published,
    projectId: linkedProject?.id ?? null,
    projectSlug: linkedProject?.slug ?? null,
    projectTitle: linkedProject?.title ?? null,
  });

  return {
    id: asset.id,
    slug: canonical.slug,
    kind: asset.kind,
    publicId: canonical.publicId,
    imageUrl: canonical.imageUrl,
    thumbnailUrl: canonical.thumbnailUrl,
    secureUrl: canonical.imageUrl,
    resourceType: canonical.resourceType,
    width: canonical.width,
    height: canonical.height,
    duration: asset.duration,
    format: canonical.format,
    bytes: asset.bytes,
    title: asset.title,
    description: asset.description,
    location: asset.location,
    primaryServiceSlug: asset.primaryServiceSlug,
    primaryServiceLabel: asset.primaryServiceSlug
      ? (findService(asset.primaryServiceSlug)?.shortTitle ?? asset.primaryServiceSlug)
      : null,
    serviceMetadata:
      asset.serviceMetadata && typeof asset.serviceMetadata === "object"
        ? (asset.serviceMetadata as Record<string, unknown>)
        : null,
    alt: asset.alt,
    published: asset.published,
    galleryFeature: asset.galleryFeature,
    isHero: asset.isHero,
    createdAt: asset.createdAt,
    uploadBatchId: asset.uploadBatchId,
    projectId: canonical.projectId,
    projectSlug: canonical.projectSlug,
    renderable: canonical.renderable,
    diagnosis: canonical.diagnosis,
    tags,
    serviceTags,
    contextTags,
    contextSlugs,
  };
}

export async function GET(request: NextRequest) {
  void request;
  if (!(await requireAdminApiSession())) {
    return unauthorizedResponse();
  }

  if (!process.env.DATABASE_URL) {
    return getDbUnavailableResponse();
  }

  const assets = await db.asset.findMany({
    select: ASSET_SELECT,
    orderBy: {
      createdAt: "desc",
    },
  });

  const serializedAssets = assets.map(serializeAdminAsset);
  for (const asset of serializedAssets) {
    console.info("admin_asset_row", {
      assetId: asset.id,
      title: asset.title,
      published: asset.published,
      hasPublicId: Boolean(asset.publicId),
      hasImageUrl: Boolean(asset.imageUrl),
      hasThumbnailUrl: Boolean(asset.thumbnailUrl),
      hasProjectLinkage: Boolean(asset.projectSlug || asset.projectId),
      diagnosis: asset.diagnosis,
    });
  }

  return NextResponse.json({
    assets: serializedAssets,
  });
}

export async function POST(request: NextRequest) {
  if (!(await requireAdminApiSession())) {
    return unauthorizedResponse();
  }

  if (!process.env.DATABASE_URL) {
    return getDbUnavailableResponse();
  }

  const body = (await request.json().catch(() => ({}))) as CreateAssetBody;

  const imageUrl = body.imageUrl?.trim() || body.secureUrl?.trim();

  if (!body.publicId || !imageUrl) {
    return NextResponse.json(
      { ok: false, error: "publicId and imageUrl are required." },
      { status: 400 },
    );
  }

  if (body.kind !== AssetKind.IMAGE && body.kind !== AssetKind.VIDEO) {
    return NextResponse.json(
      { ok: false, error: "kind must be IMAGE or VIDEO." },
      { status: 400 },
    );
  }

  const kind: AssetKind = body.kind;
  const publicId = body.publicId;
  const secureUrl = imageUrl;

  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json(
      { ok: false, error: "title is required." },
      { status: 400 },
    );
  }

  const primaryServiceSlug = body.primaryServiceSlug?.trim()
    ? body.primaryServiceSlug.trim()
    : normalizeServiceTagSlugs(body.tagSlugs)[0];

  if (!primaryServiceSlug || !isServiceTagSlug(primaryServiceSlug)) {
    return NextResponse.json(
      { ok: false, error: "A valid primary service is required." },
      { status: 400 },
    );
  }

  const metadataValidation = validateServiceAssetMetadata(
    primaryServiceSlug,
    body.serviceMetadata,
  );
  if (!metadataValidation.ok) {
    return NextResponse.json(
      { ok: false, error: metadataValidation.errors.join(" ") },
      { status: 400 },
    );
  }

  const serviceSlugs = normalizeServiceTagSlugs(
    body.tagSlugs?.length ? body.tagSlugs : [primaryServiceSlug],
  );
  const contextSlugs = normalizeContextTagSlugs(body.contextSlugs);

  const invalidContexts = (body.contextSlugs ?? []).filter((slug) => !findContext(slug));
  if (invalidContexts.length > 0) {
    return NextResponse.json(
      { ok: false, error: `Invalid context slugs: ${invalidContexts.join(", ")}` },
      { status: 400 },
    );
  }

  const description = body.description?.trim() || null;
  const location = body.location?.trim() || null;
  const alt = body.alt?.trim() || buildAssetAltText({ title, location, primaryServiceSlug });
  const uploadBatchId = body.uploadBatchId?.trim() || null;

  // ── GPS / EXIF (INTERNAL ONLY — never returned by public APIs or rendered publicly) ──
  // Validate lat/lng ranges; ignore (null out) anything out of bounds rather than failing.
  const gpsLat =
    typeof body.gpsLat === "number" && Number.isFinite(body.gpsLat) &&
    body.gpsLat >= -90 && body.gpsLat <= 90
      ? body.gpsLat
      : null;
  const gpsLng =
    typeof body.gpsLng === "number" && Number.isFinite(body.gpsLng) &&
    body.gpsLng >= -180 && body.gpsLng <= 180
      ? body.gpsLng
      : null;
  const hasGps = gpsLat !== null && gpsLng !== null;

  // Capture date: accept a parseable date that is not in the future and not absurdly old.
  let exifTakenAt: Date | null = null;
  if (body.exifTakenAt) {
    const parsed = new Date(body.exifTakenAt);
    const year = parsed.getFullYear();
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() <= Date.now() && year >= 1990) {
      exifTakenAt = parsed;
    }
  }

  // areaSlug: an explicit value from the request wins; otherwise derive from GPS.
  const explicitAreaSlug = body.areaSlug?.trim() || null;
  const areaSlug = explicitAreaSlug ?? (hasGps ? nearestAreaSlug(gpsLat, gpsLng) : null);

  try {
    const asset = await db.$transaction(async (tx) => {
      const tagDefinitions = buildAssetTagDefinitions({
        serviceSlugs,
        contextSlugs,
      });

      const tagRecords = await Promise.all(
        tagDefinitions.map((tag) =>
          tx.serviceType.upsert({
            where: {
              slug_tagType: {
                slug: tag.slug,
                tagType: tag.tagType,
              },
            },
            update: { title: tag.title },
            create: {
              slug: tag.slug,
              title: tag.title,
              tagType: tag.tagType,
            },
            select: {
              id: true,
            },
          }),
        ),
      );

      return tx.asset.create({
        data: {
          kind,
          publicId,
          secureUrl,
          width: body.width,
          height: body.height,
          duration: body.duration,
          format: body.format,
          bytes: body.bytes,
          title,
          description,
          location,
          primaryServiceSlug,
          serviceMetadata: metadataValidation.data as Prisma.InputJsonValue,
          alt: alt || null,
          uploadBatchId,
          gpsLat,
          gpsLng,
          areaSlug,
          exifTakenAt,
          published: Boolean(body.published),
          materials: Array.isArray(body.materials) ? body.materials : [],
          materialCategoryId: body.materialCategoryId || null,
          assetManufacturerId: body.assetManufacturerId || null,
          assetSupplierId: body.assetSupplierId || null,
          assetMaterialId: body.assetMaterialId || null,
          materialSheen: body.materialSheen || null,
          tags: {
            create: tagRecords.map((tag) => ({
              serviceTypeId: tag.id,
            })),
          },
        },
        select: ASSET_SELECT,
      });
    });

    return NextResponse.json({ ok: true, asset: serializeAdminAsset(asset) }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { ok: false, error: "Asset with this publicId already exists." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { ok: false, error: "Failed to create asset." },
      { status: 500 },
    );
  }
}
