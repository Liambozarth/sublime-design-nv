import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateVision } from "@/lib/ai/generateVision";
import type { Prisma } from "@prisma/client";

// Vercel: 60s timeout — GPT-4o + DALL-E together need up to 40–50s
export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const lead = await db.intakeLead.findUnique({
    where: { id },
    include: { assets: true },
  });

  if (!lead) {
    return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
  }

  await db.intakeLead.update({
    where: { id },
    data: { visionStatus: "GENERATING" },
  });

  // Run synchronously within the request — Vercel kills fire-and-forget jobs
  // when the response is sent, so we must await before returning.
  try {
    const result = await generateVision(lead);

    if (result.renderUrl) {
      await db.intakeLeadAsset.create({
        data: {
          leadId: id,
          type: "VISION_RENDER",
          url: result.renderUrl,
          caption: result.headline,
        },
      });
    }

    await db.intakeLead.update({
      where: { id },
      data: {
        visionPrompt: JSON.stringify(result.imageGenerationPrompt ?? ""),
        visionResult: result as unknown as Prisma.InputJsonValue,
        visionStatus: "COMPLETE",
        status: "VISION_GENERATED",
      },
    });

    return NextResponse.json({ ok: true, status: "COMPLETE" });
  } catch (err) {
    console.error(`[generate-route] vision generation failed for leadId ${id}:`, err instanceof Error ? err.message : err);
    await db.intakeLead.update({
      where: { id },
      data: { visionStatus: "FAILED" },
    });
    return NextResponse.json({ ok: false, status: "FAILED" }, { status: 500 });
  }
}
