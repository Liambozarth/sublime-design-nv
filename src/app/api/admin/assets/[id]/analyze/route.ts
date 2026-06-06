import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApiSession, unauthorizedResponse } from "@/lib/auth";
import { db } from "@/lib/db";
import { CANONICAL_SERVICE_SLUGS } from "@/content/services";
import { CONTEXTS, findContext } from "@/content/contexts";
import { isServiceTagSlug } from "@/lib/serviceTags";
import {
  SERVICE_ASSET_METADATA_CONFIG,
  validateServiceAssetMetadata,
} from "@/lib/serviceAssetMetadata";

// Vision calls can be slow; allow up to 60s.
export const maxDuration = 60;

type Params = { params: { id: string } };

const VALID_COLOR_SURFACES = ["cabinet", "wall", "counter", "floor", "other"] as const;
type ColorSurface = (typeof VALID_COLOR_SURFACES)[number];

type RawSuggestions = {
  primaryServiceSlug?: unknown;
  secondaryServiceSlugs?: unknown;
  contextSlugs?: unknown;
  serviceMetadata?: unknown;
  title?: unknown;
  alt?: unknown;
  descriptionShort?: unknown;
  descriptionSeo?: unknown;
  materialsVisible?: unknown;
  dominantColors?: unknown;
  qualityFlags?: unknown;
  confidence?: unknown;
};

// GPT-4o sometimes wraps JSON in ```json ... ``` fences (mirrors generateVision.ts).
function stripMarkdownFences(raw: string): string {
  const fenced = raw.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced?.[1] ?? raw.trim();
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v): v is string => v.length > 0);
}

function sanitizeColors(value: unknown): { hex: string; surface: ColorSurface }[] {
  if (!Array.isArray(value)) return [];
  const out: { hex: string; surface: ColorSurface }[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const hex = asString((entry as { hex?: unknown }).hex);
    if (!hex || !/^#?[0-9a-fA-F]{3,8}$/.test(hex)) continue;
    const rawSurface = asString((entry as { surface?: unknown }).surface)?.toLowerCase();
    const surface: ColorSurface = VALID_COLOR_SURFACES.includes(rawSurface as ColorSurface)
      ? (rawSurface as ColorSurface)
      : "other";
    out.push({ hex: hex.startsWith("#") ? hex : `#${hex}`, surface });
  }
  return out;
}

function buildPrompt(): string {
  return `You are cataloging a photo for Sublime Design NV, a custom woodwork and finish carpentry contractor in Las Vegas, Nevada. Analyze the attached image and classify it using ONLY the controlled vocabulary below. Do not invent slugs.

VALID service slugs (use these exact strings):
${CANONICAL_SERVICE_SLUGS.join(", ")}

VALID context slugs (use these exact strings):
${CONTEXTS.map((c) => c.slug).join(", ")}

Service metadata field configs (fill ONLY the object matching your chosen primaryServiceSlug; use the field "key" values and allowed option "value" strings):
${JSON.stringify(SERVICE_ASSET_METADATA_CONFIG)}

Instructions:
- Pick the single best primaryServiceSlug from the valid list. Add any additional clearly-present services to secondaryServiceSlugs.
- Pick the relevant contextSlugs (rooms/features) from the valid list.
- Fill serviceMetadata only with keys/values valid for the chosen primaryServiceSlug.
- Write a concise title, descriptive alt text, a short social description, and a longer SEO description (mention Las Vegas or the neighborhood when natural).
- List visible materials and dominant colors. For each color, give a hex value and which surface it is on (cabinet, wall, counter, floor, or other).
- Use qualityFlags for reviewer hints when applicable: "progress-shot", "protective-plastic-visible", "outside-service-taxonomy", "blurry", "poor-lighting".
- confidence is your overall confidence from 0.0 to 1.0.

Respond with STRICT JSON ONLY, no markdown, matching exactly:
{
  "primaryServiceSlug": "cabinets",
  "secondaryServiceSlugs": [],
  "contextSlugs": ["kitchen"],
  "serviceMetadata": { "doorStyle": "slab" },
  "title": "...",
  "alt": "...",
  "descriptionShort": "...",
  "descriptionSeo": "...",
  "materialsVisible": ["rift white oak veneer", "quartzite"],
  "dominantColors": [{ "hex": "#AAA294", "surface": "cabinet" }],
  "qualityFlags": [],
  "confidence": 0.0
}`;
}

export async function POST(_req: NextRequest, { params }: Params) {
  if (!(await requireAdminApiSession())) return unauthorizedResponse();

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL is not configured." },
      { status: 503 },
    );
  }

  const asset = await db.asset.findUnique({
    where: { id: params.id },
    select: { id: true, kind: true, secureUrl: true },
  });

  if (!asset) {
    return NextResponse.json({ ok: false, error: "Asset not found" }, { status: 404 });
  }
  if (asset.kind !== "IMAGE") {
    return NextResponse.json(
      { ok: false, error: "Only image assets can be analyzed" },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "OPENAI_API_KEY is not set" },
      { status: 502 },
    );
  }

  let rawText: string;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: buildPrompt() },
              { type: "image_url", image_url: { url: asset.secureUrl, detail: "high" } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      console.error(
        "[assets/analyze] OpenAI request failed:",
        errBody?.error?.message ?? response.status,
      );
      return NextResponse.json(
        { ok: false, error: "Vision analysis failed" },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    rawText = data.choices?.[0]?.message?.content ?? "";
  } catch (error) {
    console.error(
      "[assets/analyze] OpenAI request error:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: false, error: "Vision analysis failed" },
      { status: 502 },
    );
  }

  let parsed: RawSuggestions;
  try {
    parsed = JSON.parse(stripMarkdownFences(rawText)) as RawSuggestions;
  } catch {
    console.error("[assets/analyze] Failed to parse vision JSON:", rawText.slice(0, 300));
    return NextResponse.json(
      { ok: false, error: "Could not parse vision response" },
      { status: 502 },
    );
  }

  // ── Server-side taxonomy validation — strip anything invalid rather than failing ──
  const rawPrimary = asString(parsed.primaryServiceSlug);
  const primaryServiceSlug = rawPrimary && isServiceTagSlug(rawPrimary) ? rawPrimary : null;

  const secondaryServiceSlugs = asStringArray(parsed.secondaryServiceSlugs).filter(
    (slug) => isServiceTagSlug(slug) && slug !== primaryServiceSlug,
  );

  const contextSlugs = asStringArray(parsed.contextSlugs).filter((slug) =>
    Boolean(findContext(slug)),
  );

  // Validate metadata only against the chosen primary service; strip on any failure.
  let serviceMetadata: Record<string, string | number | boolean> = {};
  if (primaryServiceSlug) {
    const result = validateServiceAssetMetadata(primaryServiceSlug, parsed.serviceMetadata);
    if (result.ok) serviceMetadata = result.data;
  }

  const qualityFlags = asStringArray(parsed.qualityFlags);
  if (!primaryServiceSlug && !qualityFlags.includes("outside-service-taxonomy")) {
    qualityFlags.push("outside-service-taxonomy");
  }

  const confidenceNum =
    typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
      ? Math.min(1, Math.max(0, parsed.confidence))
      : 0;

  const suggestions = {
    primaryServiceSlug,
    secondaryServiceSlugs,
    contextSlugs,
    serviceMetadata,
    title: asString(parsed.title),
    alt: asString(parsed.alt),
    descriptionShort: asString(parsed.descriptionShort),
    descriptionSeo: asString(parsed.descriptionSeo),
    materialsVisible: asStringArray(parsed.materialsVisible),
    dominantColors: sanitizeColors(parsed.dominantColors),
    qualityFlags,
    confidence: confidenceNum,
    analyzedAt: new Date().toISOString(),
  };

  // Persist suggestions only. Do NOT auto-apply to title/alt/tags — the Phase 2 review
  // screen applies these on approve.
  await db.asset.update({
    where: { id: asset.id },
    data: { aiSuggestions: suggestions },
  });

  return NextResponse.json({ ok: true, suggestions });
}
