import { ACTIVE_SERVICES } from "@/content/services";
import { SITE } from "@/lib/constants";
import { BUDGET_OPTIONS, SMS_CONSENT_CHECKBOX_TEXT, TIMELINE_OPTIONS } from "@/lib/quoteForm";

/**
 * Wire body for POST /api/partner/v1/sdnv/leads.
 * `source` is fixed by the FieldMetriQ contract, including intake and kiosk leads.
 */
export type FieldMetriqLeadPayload = {
  event: "lead.created";
  source: "sublime-website";
  sourceLeadId: string;
  submittedAt: string;
  lead: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    smsConsent: boolean;
    smsConsentText: string | null;
    service: string;
    city: string;
    timeline: string;
    budget: string;
    message: string;
    photoUrls: string[];
    pageUrl: string;
    utm: Record<string, string> | null;
  };
};

export type FieldMetriqLeadInput = {
  sourceLeadId: string;
  submittedAt: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  smsConsent: boolean;
  smsConsentText: string | null;
  service: string;
  city: string;
  timeline: string;
  budget: string;
  message: string;
  photoUrls: string[];
  pageUrl: string;
  utm: Record<string, string> | null;
};

export type QuoteLeadForFieldMetriq = {
  leadId: string | null;
  submittedAt: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  smsConsent: boolean;
  service: string;
  location: string;
  timeline: string;
  budget: string;
  message: string;
  photoUrls: string[];
  pageUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrer?: string;
};

export type IntakeLeadForFieldMetriq = {
  id: string;
  createdAt: Date | string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  serviceType: string;
  projectNotes?: string | null;
  intakeData?: unknown;
  photoUrls: string[];
  pageUrl: string;
};

const INTAKE_SERVICE_LABELS: Record<string, string> = {
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

function publicOrigin() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || SITE.url;
  return raw.replace(/\/$/, "");
}

function optionLabel(options: readonly { value: string; label: string }[], value: string) {
  if (!value) return "";
  return options.find((option) => option.value === value)?.label ?? value;
}

export function leadServiceLabel(service: string) {
  if (service === "other") return "Other / Not sure";
  return (
    ACTIVE_SERVICES.find((item) => item.slug === service)?.shortTitle ??
    INTAKE_SERVICE_LABELS[service] ??
    service
  );
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function photoUrls(value: readonly string[]) {
  return value.map((url) => url.trim()).filter(Boolean);
}

function utmObject(input: {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrer?: string;
}): Record<string, string> | null {
  const utm: Record<string, string> = {};
  if (input.utmSource) utm.source = input.utmSource;
  if (input.utmMedium) utm.medium = input.utmMedium;
  if (input.utmCampaign) utm.campaign = input.utmCampaign;
  if (input.referrer) utm.referrer = input.referrer;
  return Object.keys(utm).length > 0 ? utm : null;
}

function intakeRecord(value: unknown) {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function intakeMessage(projectNotes: string | null | undefined, intake: Record<string, unknown>) {
  const lines: string[] = [];
  const notes = cleanString(projectNotes);
  const finalNotes = cleanString(intake.finalNotes);
  const dontWant = cleanString(intake.dontWant);
  const space = cleanString(intake.spaceOther) || cleanString(intake.space);
  if (notes) lines.push(notes);
  if (finalNotes) lines.push(finalNotes);
  if (dontWant) lines.push(`Does not want: ${dontWant}`);
  if (space) lines.push(`Space: ${space}`);
  return lines.join("\n\n");
}

export function mapQuoteLead(input: QuoteLeadForFieldMetriq): FieldMetriqLeadInput | null {
  if (!input.leadId) return null;
  return {
    sourceLeadId: input.leadId,
    submittedAt: input.submittedAt,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    smsConsent: input.smsConsent === true,
    // The checkbox is always shown on the quote form. The boolean is whether they checked it.
    smsConsentText: SMS_CONSENT_CHECKBOX_TEXT,
    service: leadServiceLabel(input.service),
    city: input.location,
    timeline: optionLabel(TIMELINE_OPTIONS, input.timeline),
    budget: optionLabel(BUDGET_OPTIONS, input.budget),
    message: input.message,
    photoUrls: photoUrls(input.photoUrls),
    pageUrl: input.pageUrl || `${publicOrigin()}/quote`,
    utm: utmObject(input),
  };
}

export function mapIntakeLead(input: IntakeLeadForFieldMetriq): FieldMetriqLeadInput {
  const intake = intakeRecord(input.intakeData);
  const selectedService = cleanString(intake.selectedServiceType);
  const submittedAt =
    input.createdAt instanceof Date ? input.createdAt.toISOString() : new Date(input.createdAt).toISOString();

  return {
    sourceLeadId: input.id,
    submittedAt,
    firstName: input.firstName,
    lastName: cleanString(input.lastName),
    email: cleanString(input.email),
    phone: cleanString(input.phone),
    smsConsent: false,
    smsConsentText: null,
    service: leadServiceLabel(selectedService || input.serviceType),
    city: "",
    timeline: cleanString(intake.timeline),
    budget: cleanString(intake.budget),
    message: intakeMessage(input.projectNotes, intake),
    photoUrls: photoUrls(input.photoUrls),
    pageUrl: input.pageUrl,
    utm: null,
  };
}

export function buildLeadCreatedPayload(input: FieldMetriqLeadInput): FieldMetriqLeadPayload {
  return {
    event: "lead.created",
    source: "sublime-website",
    sourceLeadId: input.sourceLeadId,
    submittedAt: input.submittedAt,
    lead: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      smsConsent: input.smsConsent,
      smsConsentText: input.smsConsentText,
      service: input.service,
      city: input.city,
      timeline: input.timeline,
      budget: input.budget,
      message: input.message,
      photoUrls: input.photoUrls,
      pageUrl: input.pageUrl,
      utm: input.utm,
    },
  };
}
