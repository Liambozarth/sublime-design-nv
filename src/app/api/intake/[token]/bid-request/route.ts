import { NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { sendSMS } from "@/lib/twilio/sendSMS";
import { SITE } from "@/lib/constants";

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

// Public route — called from client-facing vision page when "Request Your Quote" is clicked
// Segment is named [token] to match sibling routes; value passed may be lead id or token
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const lead = await db.intakeLead.findFirst({
    where: { OR: [{ id: token }, { token }] },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      serviceType: true,
      intakeData: true,
      status: true,
    },
  });

  if (!lead) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  await db.intakeLead.update({
    where: { id: lead.id },
    data: { status: "BID_READY" },
  });

  // Fire-and-forget notifications (don't block the response)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? SITE.url;
  const dashboardUrl = `${baseUrl}/dashboard/leads/${lead.id}`;
  const serviceLabel = SERVICE_LABELS[lead.serviceType] ?? lead.serviceType;
  const intake = (lead.intakeData ?? {}) as Record<string, unknown>;

  // Email Tyler
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#CC2027;padding:24px 28px;">
      <p style="margin:0;color:rgba(255,255,255,0.82);font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">Sublime Design NV — Bid Request</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:700;">${escapeHtml(lead.firstName)} ${escapeHtml(lead.lastName ?? "")} is ready for a quote</h1>
    </div>
    <div style="padding:28px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;color:#6b7280;font-weight:600;width:120px;">Name</td><td style="padding:6px 0;color:#111827;">${escapeHtml(lead.firstName)} ${escapeHtml(lead.lastName ?? "")}</td></tr>
        ${lead.phone ? `<tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">Phone</td><td style="padding:6px 0;color:#111827;">${escapeHtml(lead.phone)}</td></tr>` : ""}
        ${lead.email ? `<tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">Email</td><td style="padding:6px 0;color:#111827;">${escapeHtml(lead.email)}</td></tr>` : ""}
        <tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">Service</td><td style="padding:6px 0;color:#111827;">${escapeHtml(serviceLabel)}</td></tr>
        ${intake.space ? `<tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">Space</td><td style="padding:6px 0;color:#111827;">${escapeHtml(String(intake.space))}</td></tr>` : ""}
        ${intake.budget ? `<tr><td style="padding:6px 0;color:#6b7280;font-weight:600;">Budget</td><td style="padding:6px 0;color:#111827;">${escapeHtml(String(intake.budget))}</td></tr>` : ""}
      </table>
      <div style="margin-top:24px;">
        <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:#CC2027;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">View in Dashboard →</a>
      </div>
      <p style="margin-top:20px;color:#6b7280;font-size:13px;">This client has reviewed their AI concept and is ready for a bid.</p>
    </div>
  </div>
</body></html>`;

    const resend = new Resend(resendApiKey);
    const from = (process.env.LEADS_FROM_EMAIL ?? "").trim() || `${SITE.name} <admin@sublimedesignnv.com>`;
    resend.emails.send({
      from,
      to: "info@sublimedesignnv.com",
      subject: `🚨 Bid Requested — ${lead.firstName} ${lead.lastName ?? ""} is ready for a quote`,
      html,
    }).catch((err) => console.error("[bid-request] email failed:", err instanceof Error ? err.message : err));
  }

  // SMS Tyler
  const tylerPhone = process.env.TYLER_PHONE_NUMBER;
  if (tylerPhone) {
    const smsBody = `New bid request from ${lead.firstName} ${lead.lastName ?? ""} — ${serviceLabel}. View lead: ${dashboardUrl}`;
    sendSMS(tylerPhone, smsBody).catch((err) =>
      console.error("[bid-request] SMS failed:", err instanceof Error ? err.message : err),
    );
  }

  return NextResponse.json({ ok: true });
}
