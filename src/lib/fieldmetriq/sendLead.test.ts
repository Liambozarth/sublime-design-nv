import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SMS_CONSENT_CHECKBOX_TEXT } from "@/lib/quoteForm";
import { buildLeadCreatedPayload, mapIntakeLead, mapQuoteLead } from "@/lib/fieldmetriq/payload";
import { sendLeadToFieldMetriq, signSdnvPayload } from "@/lib/fieldmetriq/sendLead";
import type { FieldMetriqLeadInput } from "@/lib/fieldmetriq/payload";

const SECRET = "sdnv-test-secret";
const URL = "https://fieldmetriq.test/api/partner/v1/sdnv/leads";

function sampleInput(overrides: Partial<FieldMetriqLeadInput> = {}): FieldMetriqLeadInput {
  return {
    sourceLeadId: "lead_123",
    submittedAt: "2026-04-01T12:00:00.000Z",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    phone: "(702) 555-0100",
    smsConsent: true,
    smsConsentText: SMS_CONSENT_CHECKBOX_TEXT,
    service: "Barn Doors",
    city: "Henderson",
    timeline: "As soon as possible",
    budget: "$2,000 – $5,000",
    message: "Need a sliding barn door for the office.",
    photoUrls: ["https://cdn.example.com/door.jpg"],
    pageUrl: "https://www.sublimedesignnv.com/quote",
    utm: { source: "google", medium: "cpc" },
    ...overrides,
  };
}

describe("signSdnvPayload", () => {
  it("matches the known HMAC-SHA256 vector for timestamp.rawBody", () => {
    const timestamp = "1710000000";
    const rawBody =
      '{"event":"lead.created","source":"sublime-website","sourceLeadId":"lead_123"}';
    expect(signSdnvPayload(SECRET, timestamp, rawBody)).toBe(
      "sha256=c8736d0b259d9cf904670cf296f6301ca86bb6b216a2256eeb92839ce481cf6c",
    );
  });
});

describe("lead payload mapping", () => {
  it("maps a quote request onto the lead.created contract, including the checkbox wording", () => {
    const mapped = mapQuoteLead({
      leadId: "lead_123",
      submittedAt: "2026-04-01T12:00:00.000Z",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phone: "(702) 555-0100",
      smsConsent: true,
      service: "barn-doors",
      location: "Henderson",
      timeline: "asap",
      budget: "2k-5k",
      message: "Need a sliding barn door for the office.",
      photoUrls: [" https://cdn.example.com/door.jpg ", ""],
      pageUrl: "https://www.sublimedesignnv.com/quote?utm_source=google",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "spring",
      referrer: "https://google.com",
    });

    expect(mapped).not.toBeNull();
    const payload = buildLeadCreatedPayload(mapped!);
    expect(payload).toEqual({
      event: "lead.created",
      source: "sublime-website",
      sourceLeadId: "lead_123",
      submittedAt: "2026-04-01T12:00:00.000Z",
      lead: {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        phone: "(702) 555-0100",
        smsConsent: true,
        smsConsentText: SMS_CONSENT_CHECKBOX_TEXT,
        service: "Barn Doors",
        city: "Henderson",
        timeline: "As soon as possible",
        budget: "$2,000 – $5,000",
        message: "Need a sliding barn door for the office.",
        photoUrls: ["https://cdn.example.com/door.jpg"],
        pageUrl: "https://www.sublimedesignnv.com/quote?utm_source=google",
        utm: {
          source: "google",
          medium: "cpc",
          campaign: "spring",
          referrer: "https://google.com",
        },
      },
    });
    expect(payload.lead.smsConsentText).toContain("Reply STOP to opt out, HELP for help.");
    expect(payload.lead.smsConsentText).toContain("Privacy Policy and Terms.");
  });

  it("keeps smsConsent false while still sending the wording shown on the quote form", () => {
    const mapped = mapQuoteLead({
      leadId: "lead_no_sms",
      submittedAt: "2026-04-01T12:00:00.000Z",
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@example.com",
      phone: "(702) 555-0199",
      smsConsent: false,
      service: "other",
      location: "Las Vegas",
      timeline: "",
      budget: "",
      message: "Just looking for a rough range on trim work.",
      photoUrls: [],
    });
    expect(mapped?.smsConsent).toBe(false);
    expect(mapped?.smsConsentText).toBe(SMS_CONSENT_CHECKBOX_TEXT);
    expect(mapped?.service).toBe("Other / Not sure");
    expect(mapped?.timeline).toBe("");
    expect(mapped?.budget).toBe("");
    expect(mapped?.utm).toBeNull();
    expect(mapped?.pageUrl).toMatch(/\/quote$/);
  });

  it("maps an intake lead without an SMS checkbox", () => {
    const mapped = mapIntakeLead({
      id: "intake_123",
      createdAt: new Date("2026-04-02T15:04:05.000Z"),
      firstName: "Ken",
      lastName: null,
      email: null,
      phone: "7025550101",
      serviceType: "CABINETS",
      projectNotes: "Called about the kitchen.",
      intakeData: {
        budget: "$5,000–$10,000",
        timeline: "1–3 months",
        space: "Kitchen",
        finalNotes: "Shaker doors, white oak.",
        dontWant: "No gloss finish.",
        selectedServiceType: "FLOATING_SHELVES",
      },
      photoUrls: ["https://cdn.example.com/kitchen.jpg"],
      pageUrl: "https://sublimedesignnv.com/intake/token",
    });

    expect(buildLeadCreatedPayload(mapped)).toMatchObject({
      event: "lead.created",
      source: "sublime-website",
      sourceLeadId: "intake_123",
      submittedAt: "2026-04-02T15:04:05.000Z",
      lead: {
        firstName: "Ken",
        lastName: "",
        email: "",
        phone: "7025550101",
        smsConsent: false,
        smsConsentText: null,
        service: "Floating Shelves",
        city: "",
        timeline: "1–3 months",
        budget: "$5,000–$10,000",
        message: "Called about the kitchen.\n\nShaker doors, white oak.\n\nDoes not want: No gloss finish.\n\nSpace: Kitchen",
        photoUrls: ["https://cdn.example.com/kitchen.jpg"],
        pageUrl: "https://sublimedesignnv.com/intake/token",
        utm: null,
      },
    });
  });
});

describe("sendLeadToFieldMetriq", () => {
  const originalFetch = globalThis.fetch;
  const env = {
    url: process.env.FIELDMETRIQ_LEAD_INTAKE_URL,
    secret: process.env.SDNV_WEBHOOK_SECRET,
  };

  beforeEach(() => {
    process.env.FIELDMETRIQ_LEAD_INTAKE_URL = URL;
    process.env.SDNV_WEBHOOK_SECRET = SECRET;
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.FIELDMETRIQ_LEAD_INTAKE_URL = env.url;
    process.env.SDNV_WEBHOOK_SECRET = env.secret;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("skips silently with one log line when env vars are unset", async () => {
    delete process.env.FIELDMETRIQ_LEAD_INTAKE_URL;
    delete process.env.SDNV_WEBHOOK_SECRET;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await sendLeadToFieldMetriq(sampleInput());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledTimes(1);
  });

  it("signs the exact JSON string it sends and does not retry a 201", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "fm_1" }), { status: 201 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await sendLeadToFieldMetriq(sampleInput());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(URL);
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    const rawBody = init.body as string;
    expect(rawBody).toBe(JSON.stringify(buildLeadCreatedPayload(sampleInput())));
    expect(headers["X-SDNV-Signature"]).toBe(
      signSdnvPayload(SECRET, headers["X-SDNV-Timestamp"], rawBody),
    );
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("retries once on 500 and then stops on the next 5xx", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response("still down", { status: 500 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await sendLeadToFieldMetriq(sampleInput());

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 4xx", async () => {
    const fetchMock = vi.fn(async () => new Response("bad signature", { status: 401 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await sendLeadToFieldMetriq(sampleInput());

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once on a network error and does not throw", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(sendLeadToFieldMetriq(sampleInput())).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
