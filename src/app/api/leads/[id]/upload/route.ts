import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uploadLeadAssetToCloudinary } from "@/lib/cloudinary/uploadLeadAsset";
import { checkRateLimit, getClientIdentifier } from "@/lib/rateLimit";
import type { IntakeAssetType } from "@prisma/client";

const VALID_ASSET_TYPES: IntakeAssetType[] = [
  "SPACE_PHOTO",
  "INSPIRATION_PHOTO",
  "VIDEO",
];

// MIME allowlist + size cap. file.type is client-supplied so this is a coarse
// filter, not magic-number verification — Cloudinary's preset is the second
// line of defense. The cap below also protects against unbounded request bodies.
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const lead = await db.intakeLead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (err) {
      console.error("[upload-route] Failed to parse formData:", err instanceof Error ? err.message : err);
      return NextResponse.json({ ok: false, error: "Failed to read upload — file may be too large" }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    const type = formData.get("type") as IntakeAssetType | null;
    const caption = formData.get("caption") as string | null;

    if (!file || !type) {
      return NextResponse.json(
        { ok: false, error: "file and type are required" },
        { status: 400 },
      );
    }

    if (!VALID_ASSET_TYPES.includes(type)) {
      return NextResponse.json(
        { ok: false, error: `type must be one of: ${VALID_ASSET_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, error: "FILE_TOO_LARGE", detail: `File size ${file.size} bytes exceeds 25 MB limit` },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_MIME", detail: `MIME type ${file.type} not allowed` },
        { status: 400 },
      );
    }

    const rl = await checkRateLimit(`upload:${getClientIdentifier(request)}`);
    if (!rl.success) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMITED", detail: "Too many requests. Please wait a minute and try again." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)),
            "X-RateLimit-Limit": String(rl.limit),
            "X-RateLimit-Remaining": String(rl.remaining),
            "X-RateLimit-Reset": String(rl.reset),
          },
        },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const resourceType = file.type.startsWith("video/") ? "video" : "image";

    let uploaded;
    try {
      uploaded = await uploadLeadAssetToCloudinary(buffer, id, resourceType);
    } catch (err) {
      // Inner uploadLeadAsset already logs specifics; just return error response.
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { ok: false, error: `Upload failed: ${message}` },
        { status: 500 },
      );
    }

    const asset = await db.intakeLeadAsset.create({
      data: {
        leadId: id,
        type,
        url: uploaded.secureUrl,
        cloudinaryId: uploaded.publicId,
        caption: caption ?? undefined,
      },
    });

    return NextResponse.json({ ok: true, asset }, { status: 201 });
  } catch (err) {
    console.error("[upload-route] Unexpected error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { ok: false, error: "Unexpected server error during upload" },
      { status: 500 },
    );
  }
}
