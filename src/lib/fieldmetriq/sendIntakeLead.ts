import { SITE } from "@/lib/constants";
import { db } from "@/lib/db";
import type { IntakeLeadForFieldMetriq } from "@/lib/fieldmetriq/payload";
import { sendIntakeLeadToFieldMetriq } from "@/lib/fieldmetriq/sendLead";

type SavedIntakeLead = Omit<IntakeLeadForFieldMetriq, "photoUrls" | "pageUrl">;

function publicOrigin() {
  const raw = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? SITE.url;
  return raw.replace(/\/$/, "");
}

export function intakePageUrl(token: string, source?: string | null) {
  const path = source?.startsWith("kiosk") ? `/kiosk/intake/${token}` : `/intake/${token}`;
  return `${publicOrigin()}${path}`;
}

export function visionPageUrl(leadId: string) {
  return `${publicOrigin()}/vision/${leadId}`;
}

/**
 * One FieldMetriQ send for an intake lead. Repeats (intake submit, then bid
 * request) reuse the lead id as sourceLeadId, which FieldMetriQ treats as a duplicate.
 */
export async function deliverIntakeLead(lead: SavedIntakeLead, pageUrl: string) {
  try {
    const assets = await db.intakeLeadAsset.findMany({
      where: {
        leadId: lead.id,
        type: { in: ["SPACE_PHOTO", "INSPIRATION_PHOTO"] },
      },
      orderBy: { createdAt: "asc" },
      select: { url: true },
    });
    await sendIntakeLeadToFieldMetriq({
      ...lead,
      photoUrls: assets.map((asset) => asset.url),
      pageUrl,
    });
  } catch (error) {
    console.error(
      "[fieldmetriq] failed to prepare intake lead:",
      error instanceof Error ? error.message : error,
    );
  }
}
