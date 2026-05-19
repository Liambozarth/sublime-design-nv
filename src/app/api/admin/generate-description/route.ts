import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession, unauthorizedResponse } from "@/lib/auth";

type ColorEntry = {
  label: string;
  color: { name: string; code: string; brand: string } | null;
};

export async function POST(req: NextRequest) {
  const session = await requireAdminApiSession();
  if (!session) return unauthorizedResponse();

  const body = await req.json() as {
    primaryService?: string;
    secondaryServices?: string[];
    primaryLocation?: string;
    primaryRoom?: string;
    primaryFeature?: string;
    materialGrade?: string;
    woodSpeciesPrimary?: string;
    colorEntries?: ColorEntry[];
    serviceMetadata?: Record<string, unknown>;
    sheen?: string;
    substrate?: string[];
    finishType?: string;
  };

  const {
    primaryService,
    secondaryServices,
    primaryLocation,
    primaryRoom,
    primaryFeature,
    materialGrade,
    woodSpeciesPrimary,
    colorEntries,
    serviceMetadata,
    sheen,
    substrate,
    finishType,
  } = body;

  const contextParts: string[] = [];

  if (primaryService) contextParts.push(`Service: ${primaryService}`);
  if (secondaryServices?.length) contextParts.push(`Also includes: ${secondaryServices.join(", ")}`);
  if (primaryLocation) contextParts.push(`Location: ${primaryLocation}, Nevada`);
  if (primaryRoom) contextParts.push(`Room: ${primaryRoom}`);
  if (primaryFeature) contextParts.push(`Feature: ${primaryFeature}`);
  if (materialGrade) contextParts.push(`Material grade: ${materialGrade}`);
  if (woodSpeciesPrimary) contextParts.push(`Wood species: ${woodSpeciesPrimary}`);
  if (substrate?.length) contextParts.push(`Substrate: ${substrate.join(", ")}`);
  if (finishType) contextParts.push(`Finish type: ${finishType}`);
  if (sheen) contextParts.push(`Sheen: ${sheen}`);

  if (colorEntries?.length) {
    const colorStr = colorEntries
      .filter((e) => e.color)
      .map((e) => `${e.label ? e.label + ": " : ""}${e.color!.name} (${e.color!.code}) by ${e.color!.brand}`)
      .join(", ");
    if (colorStr) contextParts.push(`Colors used: ${colorStr}`);
  }

  if (serviceMetadata) {
    const meta = serviceMetadata;
    if (meta.shelfCount) contextParts.push(`Shelf count: ${meta.shelfCount}`);
    if (meta.doorCount) contextParts.push(`Door count: ${meta.doorCount}`);
    if (meta.bracketType) contextParts.push(`Bracket type: ${meta.bracketType}`);
    if (meta.doorStyle) contextParts.push(`Door style: ${meta.doorStyle}`);
    if (meta.boxConstruction) contextParts.push(`Box construction: ${meta.boxConstruction}`);
    if (meta.panelStyle) contextParts.push(`Panel style: ${meta.panelStyle}`);
    if (meta.tvSize) contextParts.push(`TV size: ${meta.tvSize}"`);
    if (meta.softClose) contextParts.push("Soft-close hardware included");
    if (meta.ledLighting || meta.transformerIncluded) contextParts.push("LED lighting included");
    if (meta.installIncluded) contextParts.push("Full install included");
    if (meta.customSize) contextParts.push("Custom sized");
  }

  const context = contextParts.join("\n");

  const prompt = `You are writing descriptions for a custom woodwork and finish carpentry contractor in Las Vegas, Nevada called Sublime Design NV.

Given this project metadata:
${context}

Write TWO descriptions:

1. SHORT (2-3 sentences, warm and conversational, suitable for social media captions and quick summaries. Mention the specific location if provided.)

2. SEO (1 detailed paragraph, naturally includes relevant search keywords like the service type, location, materials, and finish. Written for a homeowner searching Google. Do not use jargon. Mention Las Vegas or the specific neighborhood.)

Format your response as valid JSON only, no markdown:
{
  "short": "...",
  "seo": "..."
}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    console.error("[generate-description] OpenAI request failed:", error?.error?.message ?? response.status);
    return NextResponse.json({ error: "Failed to generate description" }, { status: 500 });
  }

  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? "";

  try {
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as { short?: string; seo?: string };
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response", raw: text }, { status: 500 });
  }
}
