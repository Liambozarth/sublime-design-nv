import { NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { SITE } from "@/lib/constants";
import { checkRateLimit } from "@/lib/rateLimit";
import type { Prisma } from "@prisma/client";

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SERVICE_LABELS: Record<string, string> = {
  BARN_DOORS: "Barn Doors",
  CABINETS: "Cabinets",
  CUSTOM_CLOSETS: "Custom Closets",
  FAUX_BEAMS: "Faux Beams",
  FLOATING_SHELVES: "Floating Shelves",
  MANTELS: "Mantels",
  TRIM_WORK: "Trim Work",
  MULTIPLE: "Multiple",
  OTHER: "Other",
};

async function notifyTylerIntakeComplete(lead: {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  serviceType: string;
  intakeData: Prisma.JsonValue;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? SITE.url;
  const dashboardUrl = `${baseUrl}/dashboard/leads/${lead.id}`;
  const serviceLabel = SERVICE_LABELS[lead.serviceType] ?? lead.serviceType;
  const intake = (lead.intakeData ?? {}) as Record<string, unknown>;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#0a1628;padding:24px 28px;">
      <p style="margin:0;color:rgba(255,255,255,0.7);font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">Sublime Design NV — New Intake</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:700;">${escapeHtml(lead.firstName)} ${escapeHtml(lead.lastName ?? "")} submitted their intake</h1>
    </div>
    <div style="padding:28px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;color:#6b7280;font-weight:600;width:120px;">Name</td><td style="padding:6px 0;color:#111827;">${escapeHtml(lead.firstName)} ${escapeHtml(lead.lastName ?? "")}</td></tr>
        ${lead.phone ? `<tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">Phone</td><td style="padding:6px 0;color:#111827;">${escapeHtml(lead.phone)}</td></tr>` : ""}
        ${lead.email ? `<tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">Email</td><td style="padding:6px 0;color:#111827;">${escapeHtml(lead.email)}</td></tr>` : ""}
        <tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">Service</td><td style="padding:6px 0;color:#111827;">${escapeHtml(serviceLabel)}</td></tr>
        ${intake.space ? `<tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">Space</td><td style="padding:6px 0;color:#111827;">${escapeHtml(String(intake.space))}</td></tr>` : ""}
        ${intake.styles ? `<tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">Style</td><td style="padding:6px 0;color:#111827;">${escapeHtml((intake.styles as string[]).join(", "))}</td></tr>` : ""}
        ${intake.budget ? `<tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">Budget</td><td style="padding:6px 0;color:#111827;">${escapeHtml(String(intake.budget))}</td></tr>` : ""}
        ${intake.timeline ? `<tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">Timeline</td><td style="padding:6px 0;color:#111827;">${escapeHtml(String(intake.timeline))}</td></tr>` : ""}
      </table>
      <div style="margin-top:24px;">
        <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:#CC2027;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">View in Dashboard →</a>
      </div>
      <p style="margin-top:20px;color:#6b7280;font-size:13px;">The AI vision concept is being generated now. Check the dashboard in about 60 seconds.</p>
    </div>
  </div>
</body></html>`;

  const resend = new Resend(resendApiKey);
  const from = (process.env.LEADS_FROM_EMAIL ?? "").trim() || `${SITE.name} <admin@sublimedesignnv.com>`;
  await resend.emails.send({
    from,
    to: "info@sublimedesignnv.com",
    subject: `New Intake Submitted — ${lead.firstName} ${lead.lastName ?? ""} (${serviceLabel})`,
    html,
  });
}

export const maxDuration = 60;

// Public route — returns limited lead fields needed to render the intake form
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const lead = await db.intakeLead.findUnique({
    where: { token },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      serviceType: true,
      status: true,
      visionStatus: true,
      assets: {
        select: {
          id: true,
          type: true,
          url: true,
          caption: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!lead) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, lead });
}

// Called by intake form to submit completed intake data
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const rl = await checkRateLimit(`intake:${token}`);
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

  const lead = await db.intakeLead.findUnique({ where: { token } });
  if (!lead) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    intakeData?: Record<string, unknown>;
    status?: "INTAKE_STARTED" | "INTAKE_COMPLETE";
    assets?: { type: string; url: string; caption?: string }[];
  };

  await db.intakeLead.update({
    where: { token },
    data: {
      ...(body.intakeData !== undefined ? { intakeData: body.intakeData as Prisma.InputJsonValue } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    },
  });

  if (body.assets && body.assets.length > 0) {
    await db.intakeLeadAsset.createMany({
      data: body.assets.map((a) => ({
        leadId: lead.id,
        type: a.type as Parameters<typeof db.intakeLeadAsset.create>[0]["data"]["type"],
        url: a.url,
        caption: a.caption,
      })),
    });
  }

  const updated = await db.intakeLead.findUnique({
    where: { token },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true, serviceType: true, intakeData: true, status: true, visionStatus: true },
  });

  // Notify Tyler when intake is complete
  if (body.status === "INTAKE_COMPLETE" && updated) {
    notifyTylerIntakeComplete(updated).catch((err) =>
      console.error("[intake-patch] failed to send Tyler notification:", err instanceof Error ? err.message : err),
    );
  }

  return NextResponse.json({ ok: true, lead: { id: updated?.id, status: updated?.status, visionStatus: updated?.visionStatus } });
}
