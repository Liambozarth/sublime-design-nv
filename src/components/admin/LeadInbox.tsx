"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LeadClassification } from "@prisma/client";
import { ACTIVE_SERVICES } from "@/content/services";
import {
  LEAD_CLASSIFICATION_OPTIONS,
  getLeadClassificationLabel,
  type LeadRecord,
  type LeadSummary,
} from "@/lib/leads";

type LeadStatus = "NEW" | "REVIEWED" | "CONTACTED" | "ARCHIVED";

type LeadInboxProps = {
  initialLeads: LeadRecord[];
  initialSummary: LeadSummary;
};

type LeadResponse = {
  ok: boolean;
  leads: LeadRecord[];
  summary: LeadSummary;
};

type LeadEditDraft = {
  name: string;
  email: string;
  phone: string;
  service: string;
  location: string;
  message: string;
  classification: LeadClassification;
};

const STATUS_OPTIONS: Array<{ value: LeadStatus | "ACTIVE" | "ALL"; label: string }> = [
  { value: "ACTIVE", label: "Active" },
  { value: "NEW", label: "New" },
  { value: "REVIEWED", label: "Reviewed" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "ARCHIVED", label: "Archived" },
  { value: "ALL", label: "All" },
];

const SOURCE_LABELS: Record<string, string> = {
  "homepage-hero": "Homepage Hero",
  "homepage-spotlight": "Homepage Spotlight",
  "homepage-card": "Homepage Card",
  "project-page": "Project Page",
  "projects-card": "Projects Card",
  "gallery-card": "Gallery Card",
  "area-card": "Area Card",
  "service-page": "Service Page",
  "service-card": "Service Card",
  "direct-quote": "Direct Quote",
};

function formatDate(value: string | Date) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTimeInput(value?: string | Date) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatRelativeTime(value?: string | Date) {
  if (!value) return "Never contacted";
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function statusClass(status: LeadStatus) {
  switch (status) {
    case "NEW":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "REVIEWED":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "CONTACTED":
      return "border-green-200 bg-green-50 text-green-700";
    case "ARCHIVED":
      return "border-gray-200 bg-gray-100 text-gray-600";
    default:
      return "border-gray-200 bg-gray-100 text-gray-600";
  }
}

function messagePreview(message: string) {
  return message.length > 180 ? `${message.slice(0, 177)}...` : message;
}

function buildPublicProjectHref(lead: LeadRecord) {
  return lead.projectSlug ? `/projects/${lead.projectSlug}` : null;
}

function buildServiceHref(lead: LeadRecord) {
  return lead.service && lead.service !== "other" ? `/services/${lead.service}` : null;
}

function buildAreaHref(lead: LeadRecord) {
  return lead.areaSlug ? `/areas/${lead.areaSlug}` : null;
}

function classificationClass(value: LeadClassification) {
  switch (value) {
    case "PROJECT_LEAD":
      return "border-purple-200 bg-purple-50 text-purple-700";
    case "SERVICE_INQUIRY":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "GENERAL_QUESTION":
      return "border-gray-200 bg-gray-100 text-gray-700";
    case "FOLLOW_UP":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "SPAM":
      return "border-red-200 bg-red-50 text-red-700";
    case "OTHER":
      return "border-stone-200 bg-stone-100 text-stone-700";
    case "QUOTE_REQUEST":
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

function toLeadEditDraft(lead: LeadRecord): LeadEditDraft {
  return {
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    service: lead.service,
    location: lead.location,
    message: lead.message,
    classification: lead.classification,
  };
}

export default function LeadInbox({ initialLeads, initialSummary }: LeadInboxProps) {
  const [leads, setLeads] = useState(initialLeads);
  const [summary, setSummary] = useState(initialSummary);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(initialLeads[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LeadStatus | "ACTIVE" | "ALL">("ACTIVE");
  const [classification, setClassification] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [service, setService] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [staleOnly, setStaleOnly] = useState(false);
  const [followUpDueOnly, setFollowUpDueOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copiedField, setCopiedField] = useState("");
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>(
    Object.fromEntries(initialLeads.map((lead) => [lead.id, lead.internalNotes ?? ""])),
  );
  const [editDrafts, setEditDrafts] = useState<Record<string, LeadEditDraft>>(
    Object.fromEntries(initialLeads.map((lead) => [lead.id, toLeadEditDraft(lead)])),
  );
  const [followUpDrafts, setFollowUpDrafts] = useState<Record<string, string>>(
    Object.fromEntries(initialLeads.map((lead) => [lead.id, formatDateTimeInput(lead.followUpAt)])),
  );

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) ?? null,
    [leads, selectedLeadId],
  );

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status) params.set("status", status);
    if (classification) params.set("classification", classification);
    if (sourceType) params.set("sourceType", sourceType);
    if (service) params.set("service", service);
    if (timeframe) params.set("timeframe", timeframe);
    if (showArchivedOnly) params.set("archived", "true");
    if (staleOnly) params.set("stale", "true");
    if (followUpDueOnly) params.set("followUpDue", "true");

    setLoading(true);
    setError("");

    fetch(`/api/admin/leads?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json()) as LeadResponse | { ok: false; error?: string };
        if (!response.ok || !("ok" in data) || !data.ok) {
          throw new Error("Unable to load leads.");
        }
        setLeads(data.leads);
        setSummary(data.summary);
        setSelectedLeadId((current) =>
          current && data.leads.some((lead) => lead.id === current)
            ? current
            : data.leads[0]?.id ?? null,
        );
        setNotesDrafts((prev) => ({
          ...prev,
          ...Object.fromEntries(data.leads.map((lead) => [lead.id, lead.internalNotes ?? ""])),
        }));
        setEditDrafts((prev) => ({
          ...prev,
          ...Object.fromEntries(data.leads.map((lead) => [lead.id, toLeadEditDraft(lead)])),
        }));
        setFollowUpDrafts((prev) => ({
          ...prev,
          ...Object.fromEntries(data.leads.map((lead) => [lead.id, formatDateTimeInput(lead.followUpAt)])),
        }));
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Unable to load leads.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [classification, followUpDueOnly, query, service, showArchivedOnly, sourceType, staleOnly, status, timeframe]);

  async function updateLead(
    id: string,
    payload: {
      status?: LeadStatus;
      classification?: LeadClassification;
      internalNotes?: string;
      name?: string;
      email?: string;
      phone?: string;
      service?: string;
      location?: string;
      message?: string;
      contactedVia?: string;
      lastContactedAt?: string | null;
      followUpAt?: string | null;
    },
  ) {
    setSavingLeadId(id);
    setError("");
    try {
      const response = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as
        | { ok: true; lead: LeadRecord }
        | { ok: false; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(("error" in data && data.error) || "Unable to update lead.");
      }

      setLeads((prev) => prev.map((lead) => (lead.id === id ? data.lead : lead)));
      setNotesDrafts((prev) => ({ ...prev, [id]: data.lead.internalNotes ?? "" }));
      setEditDrafts((prev) => ({ ...prev, [id]: toLeadEditDraft(data.lead) }));
      setFollowUpDrafts((prev) => ({ ...prev, [id]: formatDateTimeInput(data.lead.followUpAt) }));
      setSummary((prev) => {
        const current = leads.find((lead) => lead.id === id);
        if (!current || current.status === data.lead.status) return prev;
        const next = { ...prev };
        const decrement = (key: keyof LeadSummary) => {
          next[key] = Math.max(0, next[key] - 1);
        };
        const increment = (key: keyof LeadSummary) => {
          next[key] += 1;
        };
        if (current.status !== "ARCHIVED") decrement("totalActive");
        if (data.lead.status !== "ARCHIVED") increment("totalActive");
        if (current.status === "NEW") decrement("newCount");
        if (current.status === "REVIEWED") decrement("reviewedCount");
        if (current.status === "CONTACTED") decrement("contactedCount");
        if (current.status === "ARCHIVED") decrement("archivedCount");
        if (data.lead.status === "NEW") increment("newCount");
        if (data.lead.status === "REVIEWED") increment("reviewedCount");
        if (data.lead.status === "CONTACTED") increment("contactedCount");
        if (data.lead.status === "ARCHIVED") increment("archivedCount");
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update lead.");
    } finally {
      setSavingLeadId(null);
    }
  }

  async function handleContactAction(
    lead: LeadRecord,
    via: "email" | "phone",
    markContacted = false,
  ) {
    await updateLead(lead.id, {
      status: markContacted ? "CONTACTED" : undefined,
      contactedVia: via,
      lastContactedAt: new Date().toISOString(),
    });
  }

  async function copyValue(kind: "email" | "phone", value: string, leadId: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(`${kind}:${leadId}`);
      window.setTimeout(() => setCopiedField(""), 1500);
    } catch {
      setError(`Unable to copy ${kind}.`);
    }
  }

  function setQuickFollowUp(leadId: string, days: number) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(9, 0, 0, 0);
    setFollowUpDrafts((prev) => ({ ...prev, [leadId]: formatDateTimeInput(date) }));
  }

  async function deleteSelectedLead() {
    if (!selectedLead) return;
    const confirmed = window.confirm(`Delete lead "${selectedLead.name}"? This cannot be undone.`);
    if (!confirmed) return;

    setSavingLeadId(selectedLead.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/leads/${selectedLead.id}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to delete lead.");
      }

      setSummary((prev) => ({
        ...prev,
        totalActive:
          selectedLead.status === "ARCHIVED" ? prev.totalActive : Math.max(0, prev.totalActive - 1),
        newCount:
          selectedLead.status === "NEW" ? Math.max(0, prev.newCount - 1) : prev.newCount,
        reviewedCount:
          selectedLead.status === "REVIEWED" ? Math.max(0, prev.reviewedCount - 1) : prev.reviewedCount,
        contactedCount:
          selectedLead.status === "CONTACTED" ? Math.max(0, prev.contactedCount - 1) : prev.contactedCount,
        archivedCount:
          selectedLead.status === "ARCHIVED" ? Math.max(0, prev.archivedCount - 1) : prev.archivedCount,
      }));
      setLeads((prev) => prev.filter((lead) => lead.id !== selectedLead.id));
      setSelectedLeadId((current) => {
        if (current !== selectedLead.id) return current;
        return leads.find((lead) => lead.id !== selectedLead.id)?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete lead.");
    } finally {
      setSavingLeadId(null);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Active", summary.totalActive],
          ["New", summary.newCount],
          ["Reviewed", summary.reviewedCount],
          ["Contacted", summary.contactedCount],
          ["Archived", summary.archivedCount],
          ["This Week", summary.thisWeekCount],
          ["Stale", summary.staleCount],
          ["Due Follow-ups", summary.followUpDueCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="font-ui text-[10px] uppercase tracking-[0.18em] text-gray-mid">{label}</p>
            <p className="mt-2 text-2xl text-charcoal">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, phone, project, message"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-charcoal"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as LeadStatus | "ACTIVE" | "ALL")}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-charcoal"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={sourceType}
            onChange={(event) => setSourceType(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-charcoal"
          >
            <option value="">All sources</option>
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={classification}
            onChange={(event) => setClassification(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-charcoal"
          >
            <option value="">All classifications</option>
            {LEAD_CLASSIFICATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={service}
            onChange={(event) => setService(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-charcoal"
          >
            <option value="">All services</option>
            {ACTIVE_SERVICES.map((entry) => (
              <option key={entry.slug} value={entry.slug}>
                {entry.shortTitle}
              </option>
            ))}
            <option value="other">Other / Not sure</option>
          </select>
          <select
            value={timeframe}
            onChange={(event) => setTimeframe(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-charcoal"
          >
            <option value="">Any time</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
          </select>
          <label className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={showArchivedOnly}
              onChange={(event) => setShowArchivedOnly(event.target.checked)}
              className="h-4 w-4 accent-red"
            />
            Archived only
          </label>
          <label className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={staleOnly}
              onChange={(event) => setStaleOnly(event.target.checked)}
              className="h-4 w-4 accent-red"
            />
            Stale
          </label>
          <label className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={followUpDueOnly}
              onChange={(event) => setFollowUpDueOnly(event.target.checked)}
              className="h-4 w-4 accent-red"
            />
            Due follow-ups
          </label>
        </div>
        {error ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3">
          <p className="font-ui text-xs uppercase tracking-[0.18em] text-gray-mid">
            {loading ? "Refreshing leads..." : `${leads.length} leads`}
          </p>
          {leads.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-mid shadow-sm">
              No leads match the current filters.
            </div>
          ) : (
            leads.map((lead) => (
              <div
                key={lead.id}
                className={`w-full rounded-xl border p-5 text-left shadow-sm transition ${
                  selectedLeadId === lead.id
                    ? "border-red bg-red/5"
                    : lead.isStale
                      ? "border-amber-200 bg-amber-50/50 hover:border-amber-300"
                      : "border-gray-200 bg-white hover:border-red/40"
                }`}
              >
                <button type="button" onClick={() => setSelectedLeadId(lead.id)} className="w-full text-left">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-charcoal">{lead.name}</p>
                      <p className="mt-1 text-sm text-gray-mid">
                        {lead.email} · {lead.phone}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 font-ui text-xs ${statusClass(lead.status as LeadStatus)}`}>
                      {lead.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`rounded-full border px-2.5 py-1 font-ui text-[10px] uppercase tracking-[0.16em] ${classificationClass(lead.classification)}`}>
                      {getLeadClassificationLabel(lead.classification)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-mid">
                    <span>{lead.service === "other" ? "Other / Not sure" : lead.service}</span>
                    <span>{lead.location}</span>
                    {lead.sourceType ? <span>{SOURCE_LABELS[lead.sourceType] ?? lead.sourceType}</span> : null}
                    <span>{formatDate(lead.createdAt)}</span>
                    <span>{lead.lastContactedAt ? `Last contacted ${formatRelativeTime(lead.lastContactedAt)}` : "Never contacted"}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {lead.isStale ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-ui text-[10px] uppercase tracking-[0.16em] text-amber-700">
                        Stale
                      </span>
                    ) : null}
                    {lead.isFollowUpDue ? (
                      <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 font-ui text-[10px] uppercase tracking-[0.16em] text-red">
                        Follow-up due
                      </span>
                    ) : null}
                    {lead.contactedVia ? (
                      <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 font-ui text-[10px] uppercase tracking-[0.16em] text-gray-mid">
                        via {lead.contactedVia}
                      </span>
                    ) : null}
                  </div>
                  {lead.projectTitle ? (
                    <p className="mt-3 text-sm font-medium text-charcoal">{lead.projectTitle}</p>
                  ) : null}
                  <p className="mt-2 text-sm leading-6 text-charcoal/80">{messagePreview(lead.message)}</p>
                </button>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-200 pt-4">
                  <a
                    href={`mailto:${lead.email}`}
                    onClick={() => {
                      void handleContactAction(lead, "email", false);
                    }}
                    className="rounded-sm bg-red px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                  >
                    Email
                  </a>
                  <a
                    href={`tel:${lead.phone.replace(/\D/g, "")}`}
                    onClick={() => {
                      void handleContactAction(lead, "phone", false);
                    }}
                    className="rounded-sm bg-navy px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                  >
                    Call
                  </a>
                  <button
                    type="button"
                    onClick={() => void copyValue("email", lead.email, lead.id)}
                    className="rounded-sm border border-gray-200 px-3 py-2 text-xs text-charcoal hover:border-red hover:text-red"
                  >
                    {copiedField === `email:${lead.id}` ? "Copied email" : "Copy email"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyValue("phone", lead.phone, lead.id)}
                    className="rounded-sm border border-gray-200 px-3 py-2 text-xs text-charcoal hover:border-red hover:text-red"
                  >
                    {copiedField === `phone:${lead.id}` ? "Copied phone" : "Copy phone"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {selectedLead ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-2xl text-charcoal">{selectedLead.name}</p>
                  <p className="mt-1 text-sm text-gray-mid">{formatDate(selectedLead.createdAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full border px-2.5 py-1 font-ui text-xs ${statusClass(selectedLead.status as LeadStatus)}`}>
                    {selectedLead.status}
                  </span>
                  <span className={`rounded-full border px-2.5 py-1 font-ui text-xs ${classificationClass(selectedLead.classification)}`}>
                    {getLeadClassificationLabel(selectedLead.classification)}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 text-sm text-charcoal sm:grid-cols-2">
                <a href={`mailto:${selectedLead.email}`} className="rounded-lg border border-gray-200 bg-cream px-3 py-3">
                  <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-gray-mid">Email</span>
                  <span className="mt-1 block break-all">{selectedLead.email}</span>
                </a>
                <a href={`tel:${selectedLead.phone.replace(/\D/g, "")}`} className="rounded-lg border border-gray-200 bg-cream px-3 py-3">
                  <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-gray-mid">Phone</span>
                  <span className="mt-1 block">{selectedLead.phone}</span>
                  <span className="mt-1 block text-xs text-gray-mid">
                    {selectedLead.smsConsent ? "Text updates: opted in" : "Text updates: not requested"}
                  </span>
                </a>
                <div className="rounded-lg border border-gray-200 bg-cream px-3 py-3">
                  <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-gray-mid">Service</span>
                  <span className="mt-1 block">{selectedLead.service === "other" ? "Other / Not sure" : selectedLead.service}</span>
                </div>
                <div className="rounded-lg border border-gray-200 bg-cream px-3 py-3">
                  <span className="font-ui text-[10px] uppercase tracking-[0.18em] text-gray-mid">Location</span>
                  <span className="mt-1 block">{selectedLead.location}</span>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="font-ui text-[10px] uppercase tracking-[0.18em] text-gray-mid">Lead Details</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input
                    value={editDrafts[selectedLead.id]?.name ?? ""}
                    onChange={(event) =>
                      setEditDrafts((prev) => ({
                        ...prev,
                        [selectedLead.id]: { ...(prev[selectedLead.id] ?? toLeadEditDraft(selectedLead)), name: event.target.value },
                      }))
                    }
                    placeholder="Name"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-charcoal"
                  />
                  <input
                    value={editDrafts[selectedLead.id]?.email ?? ""}
                    onChange={(event) =>
                      setEditDrafts((prev) => ({
                        ...prev,
                        [selectedLead.id]: { ...(prev[selectedLead.id] ?? toLeadEditDraft(selectedLead)), email: event.target.value },
                      }))
                    }
                    placeholder="Email"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-charcoal"
                  />
                  <input
                    value={editDrafts[selectedLead.id]?.phone ?? ""}
                    onChange={(event) =>
                      setEditDrafts((prev) => ({
                        ...prev,
                        [selectedLead.id]: { ...(prev[selectedLead.id] ?? toLeadEditDraft(selectedLead)), phone: event.target.value },
                      }))
                    }
                    placeholder="Phone"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-charcoal"
                  />
                  <input
                    value={editDrafts[selectedLead.id]?.location ?? ""}
                    onChange={(event) =>
                      setEditDrafts((prev) => ({
                        ...prev,
                        [selectedLead.id]: { ...(prev[selectedLead.id] ?? toLeadEditDraft(selectedLead)), location: event.target.value },
                      }))
                    }
                    placeholder="Location"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-charcoal"
                  />
                  <select
                    value={editDrafts[selectedLead.id]?.service ?? selectedLead.service}
                    onChange={(event) =>
                      setEditDrafts((prev) => ({
                        ...prev,
                        [selectedLead.id]: { ...(prev[selectedLead.id] ?? toLeadEditDraft(selectedLead)), service: event.target.value },
                      }))
                    }
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-charcoal"
                  >
                    {ACTIVE_SERVICES.map((entry) => (
                      <option key={entry.slug} value={entry.slug}>
                        {entry.shortTitle}
                      </option>
                    ))}
                    <option value="other">Other / Not sure</option>
                  </select>
                  <select
                    value={editDrafts[selectedLead.id]?.classification ?? selectedLead.classification}
                    onChange={(event) =>
                      setEditDrafts((prev) => ({
                        ...prev,
                        [selectedLead.id]: {
                          ...(prev[selectedLead.id] ?? toLeadEditDraft(selectedLead)),
                          classification: event.target.value as LeadClassification,
                        },
                      }))
                    }
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-charcoal"
                  >
                    {LEAD_CLASSIFICATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={editDrafts[selectedLead.id]?.message ?? ""}
                    onChange={(event) =>
                      setEditDrafts((prev) => ({
                        ...prev,
                        [selectedLead.id]: { ...(prev[selectedLead.id] ?? toLeadEditDraft(selectedLead)), message: event.target.value },
                      }))
                    }
                    rows={4}
                    className="sm:col-span-2 rounded-md border border-gray-300 px-3 py-3 text-sm text-charcoal"
                    placeholder="Message"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void updateLead(selectedLead.id, {
                        ...editDrafts[selectedLead.id],
                      })
                    }
                    disabled={savingLeadId === selectedLead.id}
                    className="rounded-sm bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    Save edits
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteSelectedLead()}
                    disabled={savingLeadId === selectedLead.id}
                    className="rounded-sm border border-red/30 px-4 py-2 text-sm text-red transition hover:border-red disabled:opacity-50"
                  >
                    Delete lead
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="font-ui text-[10px] uppercase tracking-[0.18em] text-gray-mid">Actions</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`mailto:${selectedLead.email}`}
                    onClick={() => {
                      void handleContactAction(selectedLead, "email", false);
                    }}
                    className="rounded-sm bg-red px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    Email
                  </a>
                  <a
                    href={`tel:${selectedLead.phone.replace(/\D/g, "")}`}
                    onClick={() => {
                      void handleContactAction(selectedLead, "phone", false);
                    }}
                    className="rounded-sm bg-navy px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    Call
                  </a>
                  <button
                    type="button"
                    onClick={() => void copyValue("email", selectedLead.email, selectedLead.id)}
                    className="rounded-sm border border-gray-200 px-3 py-2 text-sm text-charcoal hover:border-red hover:text-red"
                  >
                    {copiedField === `email:${selectedLead.id}` ? "Copied email" : "Copy email"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyValue("phone", selectedLead.phone, selectedLead.id)}
                    className="rounded-sm border border-gray-200 px-3 py-2 text-sm text-charcoal hover:border-red hover:text-red"
                  >
                    {copiedField === `phone:${selectedLead.id}` ? "Copied phone" : "Copy phone"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void updateLead(selectedLead.id, {
                        status: "CONTACTED",
                        lastContactedAt: new Date().toISOString(),
                        contactedVia: selectedLead.contactedVia ?? "other",
                      })
                    }
                    disabled={savingLeadId === selectedLead.id}
                    className="rounded-sm border border-gray-200 px-3 py-2 text-sm text-charcoal hover:border-red hover:text-red disabled:opacity-50"
                  >
                    Mark Contacted
                  </button>
                  <a
                    href={`mailto:${selectedLead.email}`}
                    onClick={() =>
                      void handleContactAction(selectedLead, "email", true)
                    }
                    className="rounded-sm border border-gray-200 px-3 py-2 text-sm text-charcoal hover:border-red hover:text-red"
                  >
                    Contact + Mark Contacted
                  </a>
                </div>
                <div className="mt-3 text-sm text-gray-mid">
                  {selectedLead.lastContactedAt ? (
                    <span>
                      Last contacted {formatRelativeTime(selectedLead.lastContactedAt)}
                      {selectedLead.contactedVia ? ` via ${selectedLead.contactedVia}` : ""}.
                    </span>
                  ) : (
                    <span>Never contacted.</span>
                  )}
                </div>
              </div>

              <div>
                <p className="font-ui text-[10px] uppercase tracking-[0.18em] text-gray-mid">Message</p>
                <div className="mt-2 rounded-lg border border-gray-200 bg-cream px-4 py-4 text-sm leading-6 text-charcoal whitespace-pre-wrap">
                  {selectedLead.message}
                </div>
              </div>

              <div className="space-y-2 text-sm text-charcoal">
                <p className="font-ui text-[10px] uppercase tracking-[0.18em] text-gray-mid">Source Context</p>
                <div className="rounded-lg border border-gray-200 bg-cream px-4 py-4 space-y-1">
                  <p><span className="font-medium">Source:</span> {selectedLead.sourceType ? SOURCE_LABELS[selectedLead.sourceType] ?? selectedLead.sourceType : "Direct quote"}</p>
                  {selectedLead.sourcePath ? <p><span className="font-medium">Path:</span> {selectedLead.sourcePath}</p> : null}
                  {selectedLead.projectTitle ? <p><span className="font-medium">Project:</span> {selectedLead.projectTitle}</p> : null}
                  {selectedLead.projectSlug ? <p><span className="font-medium">Project Slug:</span> {selectedLead.projectSlug}</p> : null}
                  {selectedLead.areaSlug ? <p><span className="font-medium">Area:</span> {selectedLead.areaSlug}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {buildPublicProjectHref(selectedLead) ? (
                    <Link href={buildPublicProjectHref(selectedLead)!} className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-charcoal hover:border-red hover:text-red">
                      Public project
                    </Link>
                  ) : null}
                  {buildServiceHref(selectedLead) ? (
                    <Link href={buildServiceHref(selectedLead)!} className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-charcoal hover:border-red hover:text-red">
                      Service page
                    </Link>
                  ) : null}
                  {buildAreaHref(selectedLead) ? (
                    <Link href={buildAreaHref(selectedLead)!} className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-charcoal hover:border-red hover:text-red">
                      Area page
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3">
                <p className="font-ui text-[10px] uppercase tracking-[0.18em] text-gray-mid">Triage</p>
                <div className="flex flex-wrap gap-2">
                  {(["NEW", "REVIEWED", "CONTACTED", "ARCHIVED"] as LeadStatus[]).map((nextStatus) => (
                    <button
                      key={nextStatus}
                      type="button"
                      onClick={() => updateLead(selectedLead.id, { status: nextStatus })}
                      disabled={savingLeadId === selectedLead.id}
                      className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-charcoal transition hover:border-red hover:text-red disabled:opacity-50"
                    >
                      Mark {nextStatus.toLowerCase()}
                    </button>
                  ))}
                </div>
                <textarea
                  value={notesDrafts[selectedLead.id] ?? ""}
                  onChange={(event) =>
                    setNotesDrafts((prev) => ({ ...prev, [selectedLead.id]: event.target.value }))
                  }
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm text-charcoal"
                  placeholder="Internal notes for follow-up, scheduling, or callback context."
                />
                <button
                  type="button"
                  onClick={() =>
                    updateLead(selectedLead.id, {
                      internalNotes: notesDrafts[selectedLead.id] ?? "",
                    })
                  }
                  disabled={savingLeadId === selectedLead.id}
                  className="rounded-sm bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  Save notes
                </button>
              </div>

              <div className="space-y-3">
                <p className="font-ui text-[10px] uppercase tracking-[0.18em] text-gray-mid">Follow-up</p>
                <div className="rounded-lg border border-gray-200 bg-cream px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickFollowUp(selectedLead.id, 1)}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-charcoal hover:border-red hover:text-red"
                    >
                      Tomorrow
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickFollowUp(selectedLead.id, 3)}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-charcoal hover:border-red hover:text-red"
                    >
                      3 days
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickFollowUp(selectedLead.id, 7)}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-charcoal hover:border-red hover:text-red"
                    >
                      1 week
                    </button>
                  </div>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <input
                      type="datetime-local"
                      value={followUpDrafts[selectedLead.id] ?? ""}
                      onChange={(event) =>
                        setFollowUpDrafts((prev) => ({ ...prev, [selectedLead.id]: event.target.value }))
                      }
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm text-charcoal"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void updateLead(selectedLead.id, {
                          followUpAt: followUpDrafts[selectedLead.id]
                            ? new Date(followUpDrafts[selectedLead.id]).toISOString()
                            : null,
                        })
                      }
                      disabled={savingLeadId === selectedLead.id}
                      className="rounded-sm bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                      Save follow-up
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFollowUpDrafts((prev) => ({ ...prev, [selectedLead.id]: "" }));
                        void updateLead(selectedLead.id, { followUpAt: null });
                      }}
                      disabled={savingLeadId === selectedLead.id}
                      className="rounded-sm border border-gray-200 px-4 py-2 text-sm text-charcoal hover:border-red hover:text-red disabled:opacity-50"
                    >
                      Clear
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-gray-mid">
                    {selectedLead.followUpAt
                      ? `Follow up on ${formatDate(selectedLead.followUpAt)}${selectedLead.isFollowUpDue ? " · due now" : ""}.`
                      : "No follow-up reminder set."}
                  </p>
                </div>
              </div>

              {selectedLead.photoUrls.length > 0 ? (
                <div>
                  <p className="font-ui text-[10px] uppercase tracking-[0.18em] text-gray-mid">
                    Photos ({selectedLead.photoUrls.length})
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedLead.photoUrls.map((url, index) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-lg border border-gray-200"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Lead photo ${index + 1}`} className="h-20 w-28 object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="p-6 text-center text-gray-mid">Select a lead to review details.</div>
          )}
        </div>
      </div>
    </div>
  );
}
