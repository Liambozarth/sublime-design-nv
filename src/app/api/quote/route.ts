import { NextResponse } from "next/server";
import { Resend } from "resend";
import { ACTIVE_SERVICES } from "@/content/services";
import { saveLead } from "@/lib/leads";
import { SITE } from "@/lib/constants";
import { getBusinessSettings } from "@/lib/settings";
import { getRecentPublicProjectLinks } from "@/lib/projectRecords.server";
import { checkRateLimit, getClientIdentifier } from "@/lib/rateLimit";
import {
  buildQuoteSubject,
  getQuoteSpamSignals,
  isValidBudget,
  isValidTimeline,
  normalizeQuoteRequestPayload,
  validateQuoteFields,
  type QuoteFieldErrors,
} from "@/lib/quoteForm";

// ─── Types ────────────────────────────────────────────────────────────────────

type QuotePayload = {
  [key: string]: unknown;
};

// ─── Validation helpers ───────────────────────────────────────────────────────

function serviceLabel(slug: string) {
  if (slug === "other") return "Other / Not sure";
  return ACTIVE_SERVICES.find((s) => s.slug === slug)?.shortTitle ?? slug;
}

function jsonValidationError(message: string, fieldErrors: QuoteFieldErrors, status = 400) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        type: "validation",
        message,
        fieldErrors,
      },
    },
    { status },
  );
}

function jsonServerError(message: string, status = 500) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        type: "server",
        message,
      },
    },
    { status },
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getGreetingName(name: string) {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return /^[a-z][a-z'’-]*$/i.test(first) ? first : "";
}

function buildCustomerAutoReplySubject(service?: string) {
  const label = service ? serviceLabel(service) : "";
  return label && label !== "Other / Not sure"
    ? `We got your quote request for ${label} — Sublime Design NV`
    : "We got your quote request — Sublime Design NV";
}

type CustomerAutoReplyFields = {
  name: string;
  email: string;
  service: string;
  location: string;
  projectTitle?: string;
  recentProjects: { title: string; href: string }[];
};

function buildCustomerAutoReplyHtml(fields: CustomerAutoReplyFields) {
  const greetingName = getGreetingName(fields.name);
  const summaryRows = [
    fields.service ? ["Project type", serviceLabel(fields.service)] : null,
    fields.location ? ["Location", fields.location] : null,
    fields.projectTitle ? ["Inspired by", fields.projectTitle] : null,
  ].filter((row): row is [string, string] => Boolean(row));

  const summaryHtml = summaryRows.length
    ? `<div style="margin:20px 0 24px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;padding:14px 16px;">
        ${summaryRows
          .map(
            ([label, value]) =>
              `<p style="margin:0 0 8px;color:#374151;font-size:14px;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`,
          )
          .join("")}
      </div>`
    : "";

  const recentProjectsHtml = fields.recentProjects.length
    ? `<div style="margin-top:24px;">
        <p style="margin:0 0 10px;color:#111827;font-size:15px;font-weight:600;">While you wait, here are a few recent projects you can browse:</p>
        <ul style="margin:0;padding-left:18px;color:#374151;">
          ${fields.recentProjects
            .map(
              (project) =>
                `<li style="margin:0 0 8px;"><a href="${escapeHtml(project.href)}" style="color:#b91c1c;text-decoration:none;">${escapeHtml(project.title)}</a></li>`,
            )
            .join("")}
        </ul>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:620px;margin:32px auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#b91c1c;padding:24px 28px;">
      <p style="margin:0;color:rgba(255,255,255,0.82);font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">Quote Request Received</p>
      <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;font-weight:700;">We’ve got your request.</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 14px;color:#111827;font-size:16px;">Hi ${escapeHtml(greetingName || "there")},</p>
      <p style="margin:0 0 14px;color:#374151;font-size:15px;line-height:1.7;">
        Thanks for reaching out to Sublime Design NV. We received your quote request and will review the details shortly.
      </p>
      ${summaryHtml}
      <p style="margin:0;color:#374151;font-size:15px;line-height:1.7;">
        A member of our team will follow up after reviewing your request. If you want to share more details or reference photos, you can reply to this email.
      </p>
      ${recentProjectsHtml}
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;">
        <p style="margin:0 0 6px;color:#111827;font-size:15px;font-weight:600;">Thanks again,</p>
        <p style="margin:0;color:#374151;font-size:15px;">Sublime Design NV</p>
        <p style="margin:8px 0 0;font-size:14px;"><a href="${escapeHtml(SITE.url)}" style="color:#b91c1c;text-decoration:none;">${escapeHtml(SITE.url)}</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildCustomerAutoReplyText(fields: CustomerAutoReplyFields) {
  const greetingName = getGreetingName(fields.name);
  const lines = [
    `Hi ${greetingName || "there"},`,
    "",
    "Thanks for reaching out to Sublime Design NV. We received your quote request and will review the details shortly.",
    "",
  ];

  if (fields.service) lines.push(`Project type: ${serviceLabel(fields.service)}`);
  if (fields.location) lines.push(`Location: ${fields.location}`);
  if (fields.projectTitle) lines.push(`Inspired by: ${fields.projectTitle}`);

  if (fields.service || fields.location || fields.projectTitle) {
    lines.push("");
  }

  lines.push(
    "A member of our team will follow up after reviewing your request. If you want to share more details or reference photos, you can reply to this email.",
  );

  if (fields.recentProjects.length) {
    lines.push("", "While you wait, here are a few recent projects you can browse:");
    for (const project of fields.recentProjects) {
      lines.push(`- ${project.title}: ${project.href}`);
    }
  }

  lines.push("", "Thanks again,", "Sublime Design NV", SITE.url);
  return lines.join("\n");
}

// ─── Email HTML builder ───────────────────────────────────────────────────────

function buildHtmlEmail(fields: {
  name: string;
  email: string;
  phone: string;
  service: string;
  location: string;
  timeline: string;
  budget: string;
  message: string;
  photoUrls: string[];
  leadId: string | null;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrer?: string;
  sourceType?: string;
  sourcePath?: string;
  projectTitle?: string;
  projectSlug?: string;
  areaSlug?: string;
  ctaLabel?: string;
}) {
  const svcLabel = serviceLabel(fields.service);

  const row = (label: string, value: string) =>
    value
      ? `<tr>
          <td style="padding:8px 12px;font-weight:600;color:#374151;white-space:nowrap;vertical-align:top;width:140px;">${escapeHtml(label)}</td>
          <td style="padding:8px 12px;color:#1f2937;">${value}</td>
        </tr>`
      : "";

  const photosSection =
    fields.photoUrls.length > 0
      ? `<div style="margin-top:24px;">
          <p style="margin:0 0 10px;font-weight:600;color:#374151;">Photos (${fields.photoUrls.length})</p>
          <div style="display:flex;flex-wrap:wrap;gap:10px;">
            ${fields.photoUrls
              .map(
                (url, i) =>
                  `<a href="${url}" style="display:inline-block;text-decoration:none;">
                    <img src="${escapeHtml(url)}" alt="Lead photo ${i + 1}" width="160" height="120"
                         style="border-radius:6px;object-fit:cover;border:1px solid #e5e7eb;" />
                  </a>`,
              )
              .join("")}
          </div>
        </div>`
      : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background:#b91c1c;padding:24px 28px;">
      <p style="margin:0;color:rgba(255,255,255,0.8);font-size:12px;text-transform:uppercase;letter-spacing:0.1em;">New Quote Request</p>
      <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:700;">
        ${escapeHtml(svcLabel)} — ${escapeHtml(fields.location)}
      </h1>
    </div>

    <!-- Body -->
    <div style="padding:28px;">

      <!-- Contact info -->
      <p style="margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">Contact</p>
      <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
        <tbody>
          ${row("Name", escapeHtml(fields.name))}
          ${row("Email", `<a href="mailto:${escapeHtml(fields.email)}" style="color:#b91c1c;">${escapeHtml(fields.email)}</a>`)}
          ${row("Phone", `<a href="tel:${escapeHtml(fields.phone.replace(/\D/g, "").replace(/^(\d)/, "+1$1"))}" style="color:#b91c1c;">${escapeHtml(fields.phone)}</a>`)}
        </tbody>
      </table>

      <!-- Project details -->
      <p style="margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">Project</p>
      <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
        <tbody>
          ${row("Service", svcLabel)}
          ${row("Location", fields.location)}
          ${row("Timeline", fields.timeline || "—")}
          ${row("Budget", fields.budget || "—")}
        </tbody>
      </table>

      <!-- Message -->
      <p style="margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">Details</p>
      <div style="background:#f9fafb;border-radius:8px;padding:14px 16px;color:#1f2937;line-height:1.6;white-space:pre-wrap;">${escapeHtml(fields.message)}</div>

      ${photosSection}

      ${(fields.projectTitle || fields.projectSlug || fields.sourceType || fields.sourcePath || fields.areaSlug || fields.ctaLabel)
        ? `<p style="margin:24px 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">Source Context</p>
      <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
        <tbody>
          ${row("Project", fields.projectTitle ? escapeHtml(fields.projectTitle) : "")}
          ${row("Project Slug", fields.projectSlug ? escapeHtml(fields.projectSlug) : "")}
          ${row("Area", fields.areaSlug ? escapeHtml(fields.areaSlug) : "")}
          ${row("Source Type", fields.sourceType ? escapeHtml(fields.sourceType) : "")}
          ${row("Source Path", fields.sourcePath ? escapeHtml(fields.sourcePath) : "")}
          ${row("CTA", fields.ctaLabel ? escapeHtml(fields.ctaLabel) : "")}
        </tbody>
      </table>`
        : ""}

      ${(fields.utmSource || fields.utmMedium || fields.utmCampaign || fields.referrer)
        ? `<p style="margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">Attribution</p>
      <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;">
        <tbody>
          ${row("UTM Source", fields.utmSource ? escapeHtml(fields.utmSource) : "")}
          ${row("UTM Medium", fields.utmMedium ? escapeHtml(fields.utmMedium) : "")}
          ${row("UTM Campaign", fields.utmCampaign ? escapeHtml(fields.utmCampaign) : "")}
          ${row("Referrer", fields.referrer ? escapeHtml(fields.referrer) : "")}
        </tbody>
      </table>`
        : ""}

      <!-- Actions -->
      <div style="margin-top:28px;display:flex;gap:12px;">
        <a href="mailto:${escapeHtml(fields.email)}?subject=Re: ${encodeURIComponent(`Your ${svcLabel} Quote Request`)}"
           style="display:inline-block;background:#b91c1c;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
          Reply to ${escapeHtml(fields.name.split(" ")[0] || "Lead")}
        </a>
        <a href="tel:${escapeHtml(fields.phone.replace(/\D/g, "").replace(/^(\d)/, "+1$1"))}"
           style="display:inline-block;background:#1e3a5f;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
          Call ${escapeHtml(fields.phone)}
        </a>
      </div>

      ${fields.leadId ? `<p style="margin-top:20px;font-size:11px;color:#9ca3af;">Lead ID: ${escapeHtml(fields.leadId)}</p>` : ""}
    </div>
  </div>
</body>
</html>`;
}

function buildTextEmail(fields: {
  name: string;
  email: string;
  phone: string;
  service: string;
  location: string;
  timeline: string;
  budget: string;
  message: string;
  photoUrls: string[];
  sourceType?: string;
  sourcePath?: string;
  projectTitle?: string;
  projectSlug?: string;
  areaSlug?: string;
  ctaLabel?: string;
}) {
    const svcLabel = serviceLabel(fields.service);
    const lines = [
      `NEW QUOTE REQUEST — ${svcLabel.toUpperCase()} — ${fields.location.toUpperCase()}`,
    "─".repeat(50),
    "",
    "CONTACT",
    `Name:     ${fields.name}`,
    `Email:    ${fields.email}`,
    `Phone:    ${fields.phone}`,
    "",
    "PROJECT",
    `Service:  ${svcLabel}`,
    `Location: ${fields.location}`,
    `Timeline: ${fields.timeline || "Not specified"}`,
    `Budget:   ${fields.budget || "Not specified"}`,
    "",
    "DETAILS",
    fields.message,
  ];

  if (fields.photoUrls.length > 0) {
    lines.push("", "PHOTOS");
    fields.photoUrls.forEach((url, i) => lines.push(`${i + 1}. ${url}`));
  }

  if (fields.sourceType || fields.sourcePath || fields.projectSlug || fields.areaSlug) {
    lines.push("", "SOURCE");
    if (fields.sourceType) lines.push(`Source Type: ${fields.sourceType}`);
    if (fields.sourcePath) lines.push(`Source Path: ${fields.sourcePath}`);
    if (fields.projectTitle) lines.push(`Project: ${fields.projectTitle}`);
    if (fields.projectSlug) lines.push(`Project Slug: ${fields.projectSlug}`);
    if (fields.areaSlug) lines.push(`Area Slug: ${fields.areaSlug}`);
    if (fields.ctaLabel) lines.push(`CTA Label: ${fields.ctaLabel}`);
  }

  return lines.join("\n");
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as QuotePayload;
    const normalized = normalizeQuoteRequestPayload(body);
    const { fields } = normalized;
    const fieldErrors = validateQuoteFields(fields);

    if (fields.timeline && !isValidTimeline(fields.timeline)) {
      fieldErrors.timeline = "Please choose a valid timeline option.";
    }
    if (fields.budget && !isValidBudget(fields.budget)) {
      fieldErrors.budget = "Please choose a valid budget range.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      return jsonValidationError("Please review the highlighted fields and try again.", fieldErrors);
    }

    const spamSignals = getQuoteSpamSignals(normalized);
    if (spamSignals.honeypotTriggered || spamSignals.submittedTooFast) {
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    }

    const rl = await checkRateLimit(`quote:${getClientIdentifier(request)}`);
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

    // Persist lead (soft-fail)
    const leadId = await saveLead({
      name: fields.name,
      firstName: fields.firstName,
      lastName: fields.lastName,
      email: fields.email,
      phone: fields.phone,
      service: fields.service,
      location: fields.location,
      timeline: fields.timeline || undefined,
      budget: fields.budget || undefined,
      message: fields.message,
      photoUrls: normalized.photoUrls,
      sourceType: normalized.sourceType,
      sourcePath: normalized.sourcePath,
      projectTitle: normalized.projectTitle,
      projectSlug: normalized.projectSlug,
      areaSlug: normalized.areaSlug,
      utmSource: normalized.utmSource,
      utmMedium: normalized.utmMedium,
      utmCampaign: normalized.utmCampaign,
      referrer: normalized.referrer,
    });

    // Send email
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error("[quote-email] Missing RESEND_API_KEY");
      // Still return success if we at least persisted the lead
      if (leadId) {
        return NextResponse.json({ ok: true, leadId }, { status: 200 });
      }
      return NextResponse.json(
        { ok: false, error: { type: "server", message: "Email send failed. Please call us directly." } },
        { status: 500 },
      );
    }

    const resend = new Resend(resendApiKey);

    // Load notification preferences from DB settings
    const bizSettings = await getBusinessSettings().catch(() => null);
    if (bizSettings && !bizSettings.notifyNewLead) {
      // Notifications for new leads are disabled — skip email, return success
      return NextResponse.json({ ok: true, leadId }, { status: 200 });
    }

    const fromName = bizSettings?.emailFromName ?? "Sublime Design NV";
    const fromAddr = bizSettings?.emailFromAddress ?? "admin@sublimedesignnv.com";
    const replyToAddr = bizSettings?.emailReplyTo ?? fromAddr;
    const from =
      (typeof process.env.LEADS_FROM_EMAIL === "string" ? process.env.LEADS_FROM_EMAIL.trim() : "") ||
      `${fromName} <${fromAddr}>`;

    // Use DB notify addresses if set, fall back to env vars
    let recipients: string[];
    if (bizSettings?.emailNotifyAddresses?.length) {
      recipients = bizSettings.emailNotifyAddresses;
    } else {
      recipients = ["admin@sublimedesignnv.com"];
      const cc = typeof process.env.LEADS_CC_EMAIL === "string" ? process.env.LEADS_CC_EMAIL.trim() : "";
      if (cc) recipients.push(cc);
    }

    const subject = buildQuoteSubject(
      {
        firstName: fields.firstName,
        service: fields.service,
        location: fields.location,
      },
      normalized.sourceType,
      normalized.projectTitle,
    );

    const emailFields = {
      name: fields.name,
      email: fields.email,
      phone: fields.phone,
      service: fields.service,
      location: fields.location,
      timeline: fields.timeline,
      budget: fields.budget,
      message: fields.message,
      photoUrls: normalized.photoUrls,
      leadId,
      utmSource: normalized.utmSource,
      utmMedium: normalized.utmMedium,
      utmCampaign: normalized.utmCampaign,
      referrer: normalized.referrer,
      sourceType: normalized.sourceType,
      sourcePath: normalized.sourcePath,
      projectTitle: normalized.projectTitle,
      projectSlug: normalized.projectSlug,
      areaSlug: normalized.areaSlug,
      ctaLabel: normalized.ctaLabel,
    };

    const { error: sendError } = await resend.emails.send({
      from,
      to: recipients,
      subject,
      replyTo: fields.email || replyToAddr,
      html: buildHtmlEmail(emailFields),
      text: buildTextEmail(emailFields),
    });

    if (sendError) {
      console.error("[quote-email] Resend send failed:", sendError instanceof Error ? sendError.message : sendError);
      if (leadId) {
        // Lead was saved; email failed — still OK from user perspective
        return NextResponse.json({ ok: true, leadId }, { status: 200 });
      }
      return NextResponse.json(
        { ok: false, error: { type: "server", message: "Email send failed. Please call us directly." } },
        { status: 500 },
      );
    }

    try {
      const recentProjects = (await getRecentPublicProjectLinks({
        serviceSlug: fields.service !== "other" ? fields.service : undefined,
        limit: 3,
      })).map((project) => ({
        title: project.title,
        href: project.href,
      }));
      const autoReplySubject = buildCustomerAutoReplySubject(fields.service);

      const autoReplyFields = {
        name: fields.name,
        email: fields.email,
        service: fields.service,
        location: fields.location,
        projectTitle: normalized.projectTitle,
        recentProjects,
      };

      const { error: autoReplyError } = await resend.emails.send({
        from,
        to: fields.email,
        subject: autoReplySubject,
        html: buildCustomerAutoReplyHtml(autoReplyFields),
        text: buildCustomerAutoReplyText(autoReplyFields),
      });

      if (autoReplyError) {
        console.error("[quote-autoreply] Failed to send customer auto-reply:", autoReplyError instanceof Error ? autoReplyError.message : autoReplyError);
      }
    } catch (autoReplyError) {
      console.error("[quote-autoreply] Failed to send customer auto-reply:", autoReplyError instanceof Error ? autoReplyError.message : autoReplyError);
    }

    return NextResponse.json({ ok: true, leadId }, { status: 200 });
  } catch (error) {
    console.error("[quote-email] Unexpected error:", error instanceof Error ? error.message : error);
    return jsonServerError("We couldn’t submit your request right now. Please try again or call us directly.");
  }
}
