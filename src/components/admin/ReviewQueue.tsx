"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ServiceMetadataFields from "@/components/admin/ServiceMetadataFields";
import { ACTIVE_SERVICES, CANONICAL_SERVICE_SLUGS, isCanonicalServiceSlug } from "@/content/services";
import { CONTEXTS } from "@/content/contexts";
import { ACTIVE_AREAS } from "@/content/areas";

type DominantColor = { hex: string; surface: string };

type AiSuggestions = {
  primaryServiceSlug?: string | null;
  secondaryServiceSlugs?: string[];
  contextSlugs?: string[];
  serviceMetadata?: Record<string, unknown>;
  title?: string | null;
  alt?: string | null;
  descriptionShort?: string | null;
  descriptionSeo?: string | null;
  materialsVisible?: string[];
  dominantColors?: DominantColor[];
  qualityFlags?: string[];
  confidence?: number;
  analyzedAt?: string;
};

type QueueAsset = {
  id: string;
  publicId: string;
  secureUrl: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  title: string | null;
  alt: string | null;
  description: string | null;
  primaryServiceSlug: string | null;
  serviceMetadata: Record<string, unknown> | null;
  aiSuggestions: AiSuggestions | null;
  areaSlug: string | null;
  exifTakenAt: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  uploadBatchId: string | null;
  createdAt: string;
};

type FormState = {
  title: string;
  alt: string;
  shortDescription: string;
  seoDescription: string;
  primaryService: string;
  secondaryServices: string[];
  contexts: string[];
  serviceMetadata: Record<string, unknown>;
  areaSlug: string;
};

const RED = "#CC2027";
const NAVY = "#1B2A6B";

function buildForm(asset: QueueAsset): FormState {
  const ai = asset.aiSuggestions ?? {};
  const aiPrimary =
    ai.primaryServiceSlug && isCanonicalServiceSlug(ai.primaryServiceSlug)
      ? ai.primaryServiceSlug
      : null;
  const assetPrimary =
    asset.primaryServiceSlug && isCanonicalServiceSlug(asset.primaryServiceSlug)
      ? asset.primaryServiceSlug
      : null;
  return {
    title: ai.title ?? asset.title ?? "",
    alt: ai.alt ?? asset.alt ?? "",
    shortDescription: ai.descriptionShort ?? "",
    seoDescription: ai.descriptionSeo ?? asset.description ?? "",
    primaryService: aiPrimary ?? assetPrimary ?? "",
    secondaryServices: (ai.secondaryServiceSlugs ?? []).filter(
      (s) => isCanonicalServiceSlug(s) && s !== (aiPrimary ?? assetPrimary),
    ),
    contexts: (ai.contextSlugs ?? []).filter((s) => CONTEXTS.some((c) => c.slug === s)),
    serviceMetadata:
      (ai.serviceMetadata as Record<string, unknown>) ??
      asset.serviceMetadata ??
      {},
    areaSlug: asset.areaSlug ?? "",
  };
}

export default function ReviewQueue() {
  const [queue, setQueue] = useState<QueueAsset[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [descTab, setDescTab] = useState<"short" | "seo">("short");
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);

  const current = queue[index] ?? null;

  // Load the queue once on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/review-queue");
        const data = (await res.json()) as { assets?: QueueAsset[]; pendingCount?: number };
        if (!active) return;
        setQueue(data.assets ?? []);
        setPendingCount(data.pendingCount ?? (data.assets?.length ?? 0));
      } catch {
        if (active) setError("Failed to load review queue.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Re-prefill the form whenever the current asset changes.
  useEffect(() => {
    if (current) {
      setForm(buildForm(current));
      setDescTab("short");
      setPublish(true);
      setError(null);
      setZoom(false);
    } else {
      setForm(null);
    }
  }, [current]);

  function notifyBadge() {
    window.dispatchEvent(new Event("admin-review-updated"));
    window.dispatchEvent(new Event("admin-assets-refresh"));
  }

  // Remove the current asset from the queue and advance.
  const dropCurrent = useCallback(() => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
    setPendingCount((c) => Math.max(0, c - 1));
    setIndex((i) => Math.min(i, queue.length - 2 < 0 ? 0 : queue.length - 2));
    notifyBadge();
  }, [index, queue.length]);

  const skip = useCallback(() => {
    setIndex((i) => (queue.length === 0 ? 0 : (i + 1) % queue.length));
  }, [queue.length]);

  const submit = useCallback(
    async (action: "approve" | "reject") => {
      if (!current || busy) return;
      if (action === "reject" && !window.confirm("Reject this photo? It will be unpublished and removed from the queue.")) {
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const body =
          action === "approve" && form
            ? {
                action,
                publish,
                fields: {
                  title: form.title,
                  alt: form.alt,
                  description: form.seoDescription.trim() || form.shortDescription.trim() || undefined,
                  primaryServiceSlug: form.primaryService,
                  secondaryServiceSlugs: form.secondaryServices,
                  contextSlugs: form.contexts,
                  serviceMetadata: form.serviceMetadata,
                  areaSlug: form.areaSlug || null,
                },
              }
            : { action };
        const res = await fetch(`/api/admin/assets/${current.id}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setError(data.error || "Action failed.");
          setBusy(false);
          return;
        }
        dropCurrent();
      } catch {
        setError("Network error.");
      } finally {
        setBusy(false);
      }
    },
    [current, busy, form, publish, dropCurrent],
  );

  // Keyboard shortcuts: A approve, R reject, S skip (ignored while typing).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "a") { e.preventDefault(); void submit("approve"); }
      else if (k === "r") { e.preventDefault(); void submit("reject"); }
      else if (k === "s") { e.preventDefault(); skip(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit, skip]);

  const upcoming = useMemo(
    () => queue.slice(index + 1, index + 6),
    [queue, index],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function toggleSecondary(slug: string) {
    update(
      "secondaryServices",
      form?.secondaryServices.includes(slug)
        ? form.secondaryServices.filter((s) => s !== slug)
        : [...(form?.secondaryServices ?? []), slug],
    );
  }

  function toggleContext(slug: string) {
    update(
      "contexts",
      form?.contexts.includes(slug)
        ? form.contexts.filter((s) => s !== slug)
        : [...(form?.contexts ?? []), slug],
    );
  }

  if (loading) {
    return <p className="mt-10 font-ui text-sm text-gray-mid">Loading review queue…</p>;
  }

  if (!current || !form) {
    return (
      <div className="mt-10 rounded-xl border border-gray-200 bg-white p-10 text-center">
        <p className="text-2xl text-charcoal">✓ Review queue clear</p>
        <p className="mt-2 font-ui text-sm text-gray-mid">No photos waiting for review.</p>
        <Link
          href="/admin/photos"
          className="mt-5 inline-block rounded-lg bg-navy px-5 py-2.5 font-ui text-sm font-semibold text-white"
        >
          Go to Photos library
        </Link>
      </div>
    );
  }

  const ai = current.aiSuggestions ?? {};
  const areaAutoFromGps = Boolean(current.gpsLat != null && current.areaSlug);

  return (
    <div className="mt-6">
      {/* Queue header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-red px-2.5 py-0.5 font-ui text-xs font-bold text-white">
            {pendingCount} pending
          </span>
          <span className="font-ui text-sm text-gray-mid">
            Reviewing #{index + 1} of {queue.length}
          </span>
        </div>
        {upcoming.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="font-ui text-xs text-gray-400">Next:</span>
            {upcoming.map((a) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={a.id}
                src={a.thumbnailUrl ?? a.secureUrl}
                alt=""
                className="h-9 w-9 rounded object-cover"
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Photo */}
        <div>
          <button
            type="button"
            onClick={() => setZoom(true)}
            className="block w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-900"
            aria-label="Zoom photo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.thumbnailUrl ?? current.secureUrl}
              alt={form.alt || "Review photo"}
              className="max-h-[70vh] w-full object-contain"
            />
          </button>
          <p className="mt-2 font-ui text-xs text-gray-400">Tap photo to zoom · {current.publicId}</p>

          {/* AI extras — read only */}
          <div className="mt-4 space-y-3 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="font-ui text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">AI analysis</p>
              {typeof ai.confidence === "number" && (
                <span className="font-ui text-xs text-gray-400">
                  {Math.round(ai.confidence * 100)}% confidence
                </span>
              )}
            </div>

            {ai.qualityFlags && ai.qualityFlags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {ai.qualityFlags.map((flag) => (
                  <span
                    key={flag}
                    className="rounded-full bg-amber-100 px-2.5 py-0.5 font-ui text-xs font-medium text-amber-800"
                  >
                    ⚠ {flag}
                  </span>
                ))}
              </div>
            )}

            {ai.materialsVisible && ai.materialsVisible.length > 0 && (
              <div>
                <p className="font-ui text-xs font-semibold text-gray-600">Materials visible</p>
                <p className="mt-0.5 font-ui text-sm text-charcoal">{ai.materialsVisible.join(", ")}</p>
              </div>
            )}

            {ai.dominantColors && ai.dominantColors.length > 0 && (
              <div>
                <p className="font-ui text-xs font-semibold text-gray-600">
                  Color swatches <span className="font-normal text-gray-400">(paint match coming soon)</span>
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {ai.dominantColors.map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5 rounded-full border border-gray-200 py-0.5 pl-0.5 pr-2.5">
                      <span className="h-5 w-5 rounded-full border border-gray-300" style={{ backgroundColor: c.hex }} />
                      <span className="font-ui text-xs text-gray-600">{c.hex} · {c.surface}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 font-ui text-sm text-red">{error}</p>
          )}

          <Field label="Title">
            <input
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Alt text">
            <input
              type="text"
              value={form.alt}
              onChange={(e) => update("alt", e.target.value)}
              className={inputClass}
            />
          </Field>

          {/* Description short/SEO tabs */}
          <div>
            <div className="-mb-px flex gap-1 border-b border-gray-200">
              {(["short", "seo"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDescTab(tab)}
                  className="px-3 py-1.5 font-ui text-xs font-semibold transition-colors"
                  style={{
                    borderBottom: `2px solid ${descTab === tab ? RED : "transparent"}`,
                    color: descTab === tab ? RED : "#6b7280",
                  }}
                >
                  {tab === "short" ? "Social / Short" : "SEO / Long"}
                </button>
              ))}
            </div>
            <textarea
              value={descTab === "short" ? form.shortDescription : form.seoDescription}
              onChange={(e) =>
                descTab === "short"
                  ? update("shortDescription", e.target.value)
                  : update("seoDescription", e.target.value)
              }
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          <Field label="Primary service">
            <select
              value={form.primaryService}
              onChange={(e) => update("primaryService", e.target.value)}
              className={inputClass}
            >
              <option value="">Select a service…</option>
              {ACTIVE_SERVICES.map((s) => (
                <option key={s.slug} value={s.slug}>{s.shortTitle}</option>
              ))}
            </select>
          </Field>

          <Field label="Secondary services">
            <div className="flex flex-wrap gap-1.5">
              {CANONICAL_SERVICE_SLUGS.filter((slug) => slug !== form.primaryService).map((slug) => {
                const svc = ACTIVE_SERVICES.find((s) => s.slug === slug);
                const active = form.secondaryServices.includes(slug);
                return (
                  <Chip key={slug} active={active} onClick={() => toggleSecondary(slug)}>
                    {svc?.shortTitle ?? slug}
                  </Chip>
                );
              })}
            </div>
          </Field>

          <Field label="Contexts">
            <div className="space-y-2">
              {(["room", "feature"] as const).map((group) => (
                <div key={group}>
                  <p className="mb-1 font-ui text-[10px] uppercase tracking-[0.16em] text-gray-400">{group}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CONTEXTS.filter((c) => c.group === group).map((c) => (
                      <Chip key={c.slug} active={form.contexts.includes(c.slug)} onClick={() => toggleContext(c.slug)}>
                        {c.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Field>

          <Field label="Area">
            <select
              value={form.areaSlug}
              onChange={(e) => update("areaSlug", e.target.value)}
              className={inputClass}
            >
              <option value="">No area</option>
              {ACTIVE_AREAS.map((a) => (
                <option key={a.slug} value={a.slug}>{a.name}</option>
              ))}
            </select>
            {areaAutoFromGps && (
              <p className="mt-1 font-ui text-xs text-navy">— from photo GPS</p>
            )}
          </Field>

          {/* Service metadata */}
          {form.primaryService && (
            <ServiceMetadataFields
              service={form.primaryService}
              values={form.serviceMetadata}
              onChange={(key, value) =>
                update("serviceMetadata", { ...form.serviceMetadata, [key]: value })
              }
            />
          )}

          {/* Actions */}
          <div className="sticky bottom-0 space-y-3 rounded-xl border border-gray-200 bg-white p-4">
            <label className="flex cursor-pointer items-center gap-2 font-ui text-sm text-charcoal">
              <input
                type="checkbox"
                checked={publish}
                onChange={(e) => setPublish(e.target.checked)}
                className="rounded border-gray-300 accent-emerald-600"
              />
              Publish to site on approve
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit("approve")}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 font-ui text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Approve (A)"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit("reject")}
                className="rounded-lg px-4 py-2.5 font-ui text-sm font-semibold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: RED }}
              >
                Reject (R)
              </button>
              <button
                type="button"
                disabled={busy || queue.length < 2}
                onClick={skip}
                className="rounded-lg border border-gray-300 px-4 py-2.5 font-ui text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Skip (S)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Zoom overlay */}
      {zoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setZoom(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.secureUrl} alt={form.alt} className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}

const inputClass =
  "mt-1 w-full rounded-sm border border-gray-warm bg-white px-3 py-2 font-ui text-sm text-charcoal outline-none transition focus:border-navy";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-ui text-sm font-semibold text-charcoal">{label}</span>
      {children}
    </label>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-3 py-1 font-ui text-xs font-medium transition-colors"
      style={{
        backgroundColor: active ? NAVY : "white",
        color: active ? "white" : "#374151",
        borderColor: active ? NAVY : "#d1d5db",
      }}
    >
      {children}
    </button>
  );
}
