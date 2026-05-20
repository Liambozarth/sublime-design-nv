import { LeadClassification, LeadStatus, Prisma } from "@prisma/client";

export type LeadInput = {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  service: string;
  location: string;
  timeline?: string;
  budget?: string;
  message: string;
  photoUrls: string[];
  sourceType?: string;
  sourcePath?: string;
  projectTitle?: string;
  projectSlug?: string;
  areaSlug?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrer?: string;
  classification?: LeadClassification;
};

export type LeadRecord = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  email: string;
  phone: string;
  service: string;
  location: string;
  timeline?: string;
  budget?: string;
  message: string;
  photoUrls: string[];
  status: LeadStatus;
  classification: LeadClassification;
  sourceType?: string;
  sourcePath?: string;
  projectTitle?: string;
  projectSlug?: string;
  areaSlug?: string;
  internalNotes?: string;
  lastContactedAt?: Date;
  contactedVia?: string;
  followUpAt?: Date;
  archivedAt?: Date;
  isStale: boolean;
  isFollowUpDue: boolean;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrer?: string;
};

export type LeadFilters = {
  q?: string;
  status?: LeadStatus | "ACTIVE" | "ALL";
  classification?: LeadClassification;
  sourceType?: string;
  service?: string;
  timeframe?: "today" | "week";
  archived?: boolean;
  stale?: boolean;
  followUpDue?: boolean;
  take?: number;
};

export type LeadSummary = {
  totalActive: number;
  newCount: number;
  reviewedCount: number;
  contactedCount: number;
  archivedCount: number;
  thisWeekCount: number;
  staleCount: number;
  followUpDueCount: number;
};

export const LEAD_STALE_DAYS = 2;

export const LEAD_CLASSIFICATION_OPTIONS: Array<{
  value: LeadClassification;
  label: string;
}> = [
  { value: LeadClassification.QUOTE_REQUEST, label: "Quote Request" },
  { value: LeadClassification.PROJECT_LEAD, label: "Project Lead" },
  { value: LeadClassification.SERVICE_INQUIRY, label: "Service Inquiry" },
  { value: LeadClassification.GENERAL_QUESTION, label: "General Question" },
  { value: LeadClassification.FOLLOW_UP, label: "Follow Up" },
  { value: LeadClassification.SPAM, label: "Spam" },
  { value: LeadClassification.OTHER, label: "Other" },
];

export function getLeadClassificationLabel(value: LeadClassification) {
  return LEAD_CLASSIFICATION_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function inferLeadClassification(input: Pick<LeadInput, "sourceType" | "projectSlug" | "service">) {
  if (input.projectSlug || input.sourceType === "project-page" || input.sourceType === "projects-card") {
    return LeadClassification.PROJECT_LEAD;
  }
  if (input.service && input.service !== "other") {
    return LeadClassification.SERVICE_INQUIRY;
  }
  return LeadClassification.QUOTE_REQUEST;
}

function mapLead(row: {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  email: string;
  phone: string;
  service: string;
  location: string;
  timeline: string | null;
  budget: string | null;
  message: string;
  photoUrls: string[];
  status: LeadStatus;
  classification: LeadClassification;
  sourceType: string | null;
  sourcePath: string | null;
  projectTitle: string | null;
  projectSlug: string | null;
  areaSlug: string | null;
  internalNotes: string | null;
  lastContactedAt: Date | null;
  contactedVia: string | null;
  followUpAt: Date | null;
  archivedAt: Date | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrer: string | null;
}): LeadRecord {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    name: row.name,
    email: row.email,
    phone: row.phone,
    service: row.service,
    location: row.location,
    timeline: row.timeline ?? undefined,
    budget: row.budget ?? undefined,
    message: row.message,
    photoUrls: row.photoUrls,
    status: row.status,
    classification: row.classification,
    sourceType: row.sourceType ?? undefined,
    sourcePath: row.sourcePath ?? undefined,
    projectTitle: row.projectTitle ?? undefined,
    projectSlug: row.projectSlug ?? undefined,
    areaSlug: row.areaSlug ?? undefined,
    internalNotes: row.internalNotes ?? undefined,
    lastContactedAt: row.lastContactedAt ?? undefined,
    contactedVia: row.contactedVia ?? undefined,
    followUpAt: row.followUpAt ?? undefined,
    archivedAt: row.archivedAt ?? undefined,
    isStale: computeIsStale(row.status, row.lastContactedAt),
    isFollowUpDue: computeIsFollowUpDue(row.status, row.followUpAt),
    utmSource: row.utmSource ?? undefined,
    utmMedium: row.utmMedium ?? undefined,
    utmCampaign: row.utmCampaign ?? undefined,
    referrer: row.referrer ?? undefined,
  };
}

function staleThresholdDate() {
  return new Date(Date.now() - LEAD_STALE_DAYS * 24 * 60 * 60 * 1000);
}

function computeIsStale(status: LeadStatus, lastContactedAt: Date | null) {
  if (status === LeadStatus.ARCHIVED) return false;
  if (!lastContactedAt) return true;
  return lastContactedAt < staleThresholdDate();
}

function computeIsFollowUpDue(status: LeadStatus, followUpAt: Date | null) {
  if (status === LeadStatus.ARCHIVED) return false;
  if (!followUpAt) return false;
  return followUpAt <= new Date();
}

function getTimeframeDate(timeframe?: LeadFilters["timeframe"]) {
  if (timeframe === "today") {
    return new Date(Date.now() - 24 * 60 * 60 * 1000);
  }
  if (timeframe === "week") {
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }
  return undefined;
}

async function getDb() {
  if (!process.env.DATABASE_URL) return null;
  const { db } = await import("@/lib/db");
  return db;
}

export async function saveLead(input: LeadInput): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const lead = await db.lead.create({
      data: {
        name: input.name,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        service: input.service,
        location: input.location,
        timeline: input.timeline ?? null,
        budget: input.budget ?? null,
        message: input.message,
        photoUrls: input.photoUrls,
        status: LeadStatus.NEW,
        classification: input.classification ?? inferLeadClassification(input),
        sourceType: input.sourceType ?? null,
        sourcePath: input.sourcePath ?? null,
        projectTitle: input.projectTitle ?? null,
        projectSlug: input.projectSlug ?? null,
        areaSlug: input.areaSlug ?? null,
        utmSource: input.utmSource ?? null,
        utmMedium: input.utmMedium ?? null,
        utmCampaign: input.utmCampaign ?? null,
        referrer: input.referrer ?? null,
      },
    });
    return lead.id;
  } catch (error) {
    console.error("[leads] Failed to persist lead:", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function listLeads(filters: LeadFilters = {}) {
  const db = await getDb();
  if (!db) return [];

  const timeframeDate = getTimeframeDate(filters.timeframe);
  const q = filters.q?.trim();

  const and: Prisma.LeadWhereInput[] = [];
  if (filters.archived === true) {
    and.push({ status: LeadStatus.ARCHIVED });
  } else if (filters.status === "ACTIVE") {
    and.push({ status: { not: LeadStatus.ARCHIVED } });
  } else if (filters.status && filters.status !== "ALL") {
    and.push({ status: filters.status });
  }
  if (filters.sourceType) {
    and.push({ sourceType: filters.sourceType });
  }
  if (filters.classification) {
    and.push({ classification: filters.classification });
  }
  if (filters.service) {
    and.push({ service: filters.service });
  }
  if (filters.stale) {
    and.push({
      OR: [
        { lastContactedAt: null },
        { lastContactedAt: { lt: staleThresholdDate() } },
      ],
    });
    and.push({ status: { not: LeadStatus.ARCHIVED } });
  }
  if (filters.followUpDue) {
    and.push({ followUpAt: { lte: new Date() } });
    and.push({ status: { not: LeadStatus.ARCHIVED } });
  }
  if (timeframeDate) {
    and.push({ createdAt: { gte: timeframeDate } });
  }
  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { projectTitle: { contains: q, mode: "insensitive" } },
        { message: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const where: Prisma.LeadWhereInput = and.length > 0 ? { AND: and } : {};

  const rows = await db.lead.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: filters.take ?? 200,
  });

  return rows.map(mapLead);
}

export async function getLeadById(id: string) {
  const db = await getDb();
  if (!db) return null;
  const row = await db.lead.findUnique({ where: { id } });
  return row ? mapLead(row) : null;
}

export async function updateLead(
  id: string,
  updates: {
    status?: LeadStatus;
    classification?: LeadClassification;
    internalNotes?: string | null;
    name?: string;
    email?: string;
    phone?: string;
    service?: string;
    location?: string;
    message?: string;
    contactedVia?: string | null;
    lastContactedAt?: Date | null;
    followUpAt?: Date | null;
  },
) {
  const db = await getDb();
  if (!db) return null;

  const row = await db.lead.update({
    where: { id },
    data: {
      status: updates.status,
      classification: updates.classification,
      name: updates.name,
      email: updates.email,
      phone: updates.phone,
      service: updates.service,
      location: updates.location,
      message: updates.message,
      internalNotes: updates.internalNotes,
      archivedAt:
        updates.status === LeadStatus.ARCHIVED
          ? new Date()
          : updates.status
            ? null
            : undefined,
      lastContactedAt:
        updates.lastContactedAt !== undefined
          ? updates.lastContactedAt
          : updates.status === LeadStatus.CONTACTED
            ? new Date()
            : undefined,
      contactedVia: updates.contactedVia,
      followUpAt: updates.followUpAt,
    },
  });

  return mapLead(row);
}

export async function deleteLead(id: string) {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.lead.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function getLeadSummary(): Promise<LeadSummary> {
  const db = await getDb();
  if (!db) {
    return {
      totalActive: 0,
      newCount: 0,
      reviewedCount: 0,
      contactedCount: 0,
      archivedCount: 0,
      thisWeekCount: 0,
      staleCount: 0,
      followUpDueCount: 0,
    };
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const threshold = staleThresholdDate();
  const now = new Date();
  const [
    totalActive,
    newCount,
    reviewedCount,
    contactedCount,
    archivedCount,
    thisWeekCount,
    staleCount,
    followUpDueCount,
  ] =
    await Promise.all([
      db.lead.count({ where: { status: { not: LeadStatus.ARCHIVED } } }),
      db.lead.count({ where: { status: LeadStatus.NEW } }),
      db.lead.count({ where: { status: LeadStatus.REVIEWED } }),
      db.lead.count({ where: { status: LeadStatus.CONTACTED } }),
      db.lead.count({ where: { status: LeadStatus.ARCHIVED } }),
      db.lead.count({ where: { createdAt: { gte: weekAgo } } }),
      db.lead.count({
        where: {
          status: { not: LeadStatus.ARCHIVED },
          OR: [{ lastContactedAt: null }, { lastContactedAt: { lt: threshold } }],
        },
      }),
      db.lead.count({
        where: {
          status: { not: LeadStatus.ARCHIVED },
          followUpAt: { lte: now },
        },
      }),
    ]);

  return {
    totalActive,
    newCount,
    reviewedCount,
    contactedCount,
    archivedCount,
    thisWeekCount,
    staleCount,
    followUpDueCount,
  };
}

export async function getRecentLeads(limit = 50): Promise<LeadRecord[]> {
  return listLeads({ take: limit });
}
