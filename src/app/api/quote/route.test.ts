import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SMS_CONSENT_CHECKBOX_TEXT } from "@/lib/quoteForm";

vi.mock("@/lib/leads", () => ({
  saveLead: vi.fn(async () => "lead_cuid_test"),
}));

vi.mock("@/lib/settings", () => ({
  getBusinessSettings: vi.fn(async () => null),
}));

vi.mock("@/lib/projectRecords.server", () => ({
  getRecentPublicProjectLinks: vi.fn(async () => []),
}));

import { POST } from "./route";

const ORIGINAL_ENV = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  FIELDMETRIQ_LEAD_INTAKE_URL: process.env.FIELDMETRIQ_LEAD_INTAKE_URL,
  SDNV_WEBHOOK_SECRET: process.env.SDNV_WEBHOOK_SECRET,
};

function quoteRequest() {
  return new Request("https://www.sublimedesignnv.com/api/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phone: "(702) 555-0100",
      smsConsent: true,
      service: "barn-doors",
      location: "Henderson",
      timeline: "asap",
      budget: "2k-5k",
      message: "Need a sliding barn door for the office opening.",
      photoUrls: ["https://cdn.example.com/door.jpg"],
      consent: true,
      pageUrl: "https://www.sublimedesignnv.com/quote",
      utmSource: "google",
      startedAt: Date.now() - 10_000,
    }),
  });
}

describe("POST /api/quote", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    process.env.FIELDMETRIQ_LEAD_INTAKE_URL = "https://fieldmetriq.test/api/partner/v1/sdnv/leads";
    process.env.SDNV_WEBHOOK_SECRET = "sdnv-test-secret";
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = ORIGINAL_ENV.RESEND_API_KEY;
    process.env.FIELDMETRIQ_LEAD_INTAKE_URL = ORIGINAL_ENV.FIELDMETRIQ_LEAD_INTAKE_URL;
    process.env.SDNV_WEBHOOK_SECRET = ORIGINAL_ENV.SDNV_WEBHOOK_SECRET;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns success when FieldMetriQ fails", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("fieldmetriq down");
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(quoteRequest());
    const body = (await response.json()) as { ok?: boolean; leadId?: string };

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, leadId: "lead_cuid_test" });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const init = fetchMock.mock.calls[0]?.[1] as unknown as RequestInit;
    const sent = JSON.parse(init.body as string) as {
      event: string;
      source: string;
      sourceLeadId: string;
      lead: { smsConsent: boolean; smsConsentText: string; city: string; service: string };
    };
    expect(sent.event).toBe("lead.created");
    expect(sent.source).toBe("sublime-website");
    expect(sent.sourceLeadId).toBe("lead_cuid_test");
    expect(sent.lead.smsConsent).toBe(true);
    expect(sent.lead.smsConsentText).toBe(SMS_CONSENT_CHECKBOX_TEXT);
    expect(sent.lead.city).toBe("Henderson");
    expect(sent.lead.service).toBe("Barn Doors");
  });
});
