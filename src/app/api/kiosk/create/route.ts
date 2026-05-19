import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkKioskRateLimit, getClientIdentifier } from "@/lib/rateLimit";
import type { IntakeServiceType } from "@prisma/client";

const VALID_SERVICE_TYPES: IntakeServiceType[] = [
  "BARN_DOORS",
  "CABINETS",
  "CUSTOM_CLOSETS",
  "FAUX_BEAMS",
  "FLOATING_SHELVES",
  "MANTELS",
  "TRIM_WORK",
  "MULTIPLE",
  "OTHER",
];

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    firstName?: string;
    phone?: string;
    serviceType?: string;
    source?: string;
  } | null;

  if (!body?.firstName?.trim() || !body?.serviceType) {
    return NextResponse.json(
      { ok: false, error: "firstName and serviceType are required" },
      { status: 400 },
    );
  }

  const serviceType = body.serviceType as IntakeServiceType;
  if (!VALID_SERVICE_TYPES.includes(serviceType)) {
    return NextResponse.json(
      { ok: false, error: "Invalid serviceType" },
      { status: 400 },
    );
  }

  const rl = await checkKioskRateLimit(`kiosk:${getClientIdentifier(request)}`);
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

  const lead = await db.intakeLead.create({
    data: {
      firstName: body.firstName.trim(),
      phone: body.phone?.replace(/\D/g, "") || undefined,
      serviceType,
      source: body.source ?? "kiosk-tradeshow",
      status: "INTAKE_STARTED",
    },
  });

  return NextResponse.json({ ok: true, token: lead.token });
}
