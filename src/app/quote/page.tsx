"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { uploadLeadPhoto } from "@/lib/cloudinaryUpload";
import { trackEvent } from "@/lib/analytics";
import { SERVICES, findService } from "@/content/services";
import { readQuotePrefill, type QuotePrefillContext } from "@/lib/publicLeadCtas";
import { PhoneInput } from "@/components/ui/PhoneInput";
import {
  applyQuotePrefillToForm,
  BUDGET_OPTIONS,
  QUOTE_DEFAULT_FORM,
  TIMELINE_OPTIONS,
  getQuoteVisibleContext,
  validateQuoteFields,
  type QuoteFieldErrors,
  type QuoteFieldName,
  type QuoteFormFields,
} from "@/lib/quoteForm";

// ─── Service options ──────────────────────────────────────────────────────────
const SERVICE_OPTIONS = SERVICES;

const NEXT_STEPS = [
  "We review your service, location, and project details.",
  "If needed, we follow up to confirm measurements, photos, or scheduling.",
  "You get the next step for pricing, site visit, or installation timing.",
] as const;

const SUCCESS_REASSURANCE = [
  "A local finish carpentry team reviews the request directly.",
  "Your project context and uploaded photos stay attached to the quote.",
  "Follow-up stays simple by phone or email.",
] as const;

const MAX_PHOTOS = 5;
const MAX_FILE_MB = 10;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

// ─── Types ────────────────────────────────────────────────────────────────────

type PhotoState = {
  file: File;
  previewUrl: string;
  status: "pending" | "uploading" | "done" | "error";
  cloudUrl?: string;
  errorMsg?: string;
};

type QuoteSuccessProject = {
  title: string;
  href: string;
  serviceLabel?: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function serviceSuccessCopy(slug: string): string {
  const service = findService(slug);
  if (!service) return "We'll review your request and reach out shortly with next steps.";
  return `We'll review your ${service.shortTitle.toLowerCase()} request and reach out shortly with next steps.`;
}

function getSuccessRecap(form: QuoteFormFields, context: QuotePrefillContext) {
  if (context.projectTitle) {
    return `We received your request inspired by ${context.projectTitle}.`;
  }

  const service = findService(form.service || context.serviceSlug || "");
  if (service) {
    return `We received your request about ${service.shortTitle}.`;
  }

  return "We received your request and queued it for review.";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-600">{msg}</p>;
}

function inputClass(hasError: boolean) {
  return `mt-1 w-full rounded-md border px-3 py-2.5 text-sm text-charcoal shadow-sm transition focus:outline-none focus:ring-2 focus:ring-red/40 ${
    hasError ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"
  }`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 font-ui text-xs uppercase tracking-widest text-gray-mid">{children}</p>
  );
}

// ─── Photo upload section ─────────────────────────────────────────────────────

function PhotoUploadSection({
  photos,
  onAdd,
  onRemove,
  uploadsEnabled,
}: {
  photos: PhotoState[];
  onAdd: (files: FileList) => void;
  onRemove: (index: number) => void;
  uploadsEnabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canAdd = photos.length < MAX_PHOTOS && uploadsEnabled;

  return (
    <div>
      <SectionLabel>Photos (optional)</SectionLabel>
      <p className="mb-3 text-sm text-gray-mid">
        Upload up to {MAX_PHOTOS} photos of the space — before shots, measurements, or inspiration.
      </p>

      {photos.length > 0 ? (
        <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {photos.map((photo, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-cream">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.previewUrl}
                alt={`Upload ${i + 1}`}
                className="h-full w-full object-cover"
              />
              {/* Status overlay */}
              {photo.status === "uploading" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                  <svg className="h-5 w-5 animate-spin text-red" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                </div>
              ) : photo.status === "error" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-red-50/90">
                  <span className="text-xs text-red-600">Failed</span>
                </div>
              ) : photo.status === "done" ? (
                <div className="absolute right-1 top-1">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] text-white">✓</span>
                </div>
              ) : null}
              {/* Remove button */}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-[10px] text-white hover:bg-black/70"
                aria-label="Remove photo"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {canAdd ? (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES.join(",")}
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) onAdd(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 bg-cream px-4 py-3 text-sm text-gray-mid transition hover:border-red hover:text-red"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add photos {photos.length > 0 ? `(${photos.length}/${MAX_PHOTOS})` : ""}
          </button>
        </>
      ) : photos.length >= MAX_PHOTOS ? (
        <p className="text-sm text-gray-mid">Maximum {MAX_PHOTOS} photos reached.</p>
      ) : null}
    </div>
  );
}

// ─── Success state ────────────────────────────────────────────────────────────

function SuccessState({
  service,
  context,
  projects,
}: {
  service: string;
  context: QuotePrefillContext;
  projects: QuoteSuccessProject[];
}) {
  const visibleContext = getQuoteVisibleContext(context);
  const recap = getSuccessRecap({ ...QUOTE_DEFAULT_FORM, service }, context);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-green-200 bg-white p-8 shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="text-center">
          <p className="font-ui text-xs uppercase tracking-[0.18em] text-green-700">Quote Request Received</p>
          <h2 className="mt-3 text-2xl font-semibold text-charcoal md:text-3xl">
            Thanks. Your request is in.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-mid">
            {serviceSuccessCopy(service)}
          </p>
          <p className="mt-3 text-sm font-medium text-charcoal">{recap}</p>
          {visibleContext.summary && visibleContext.summary !== recap ? (
            <p className="mt-2 text-sm text-gray-mid">{visibleContext.summary}</p>
          ) : null}
          <p className="mt-2 text-sm text-gray-mid">
            Expect a response within one business day. We’ll review your details and follow up by phone or email if we need measurements, photos, or scheduling info.
          </p>
        </div>

        <div className="mt-6 grid gap-4 rounded-xl border border-gray-200 bg-cream p-5 md:grid-cols-2">
          <div>
            <p className="font-ui text-[10px] uppercase tracking-[0.18em] text-red">What Happens Next</p>
            <ol className="mt-2 space-y-2 text-sm text-gray-mid">
              {NEXT_STEPS.map((step, index) => (
                <li key={step} className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-navy text-[10px] font-semibold text-white">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="font-ui text-[10px] uppercase tracking-[0.18em] text-red">Helpful While You Wait</p>
            <ul className="mt-2 space-y-2 text-sm text-gray-mid">
              {SUCCESS_REASSURANCE.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="font-ui inline-flex items-center rounded-sm bg-red px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:opacity-90"
          >
            Back to Home
          </Link>
          <Link
            href="/projects"
            className="font-ui inline-flex items-center rounded-sm border border-gray-200 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-charcoal transition hover:border-red hover:text-red"
          >
            View Projects
          </Link>
          <Link
            href="/services"
            className="font-ui inline-flex items-center rounded-sm border border-gray-200 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-charcoal transition hover:border-red hover:text-red"
          >
            Browse Services
          </Link>
        </div>
      </div>

      {projects.length > 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-ui text-xs uppercase tracking-[0.18em] text-red">Recent Work</p>
              <h3 className="mt-2 text-xl text-charcoal">A few projects to explore while you wait</h3>
            </div>
            <Link href="/projects" className="font-ui text-xs font-semibold uppercase tracking-[0.16em] text-red hover:underline">
              All Projects
            </Link>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.href}
                href={project.href}
                className="rounded-xl border border-gray-200 bg-cream p-4 transition hover:-translate-y-0.5 hover:border-red hover:bg-white"
              >
                <p className="font-ui text-[10px] uppercase tracking-[0.18em] text-gray-mid">
                  {project.serviceLabel || "Project"}
                </p>
                <p className="mt-2 text-sm font-medium leading-6 text-charcoal">{project.title}</p>
                <p className="mt-3 font-ui text-[10px] uppercase tracking-[0.16em] text-red">View Project</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── UTM capture ──────────────────────────────────────────────────────────────

type UtmFields = {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  referrer: string;
};

function captureUtm(): UtmFields {
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  );
  return {
    utmSource: params.get("utm_source") ?? "",
    utmMedium: params.get("utm_medium") ?? "",
    utmCampaign: params.get("utm_campaign") ?? "",
    referrer: typeof document !== "undefined" ? document.referrer : "",
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QuotePage() {
  const [form, setForm] = useState<QuoteFormFields>(QUOTE_DEFAULT_FORM);
  const [errors, setErrors] = useState<QuoteFieldErrors>({});
  const [photos, setPhotos] = useState<PhotoState[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [submitError, setSubmitError] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [honeypot, setHoneypot] = useState("");
  const [utm, setUtm] = useState<UtmFields>({
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
    referrer: "",
  });
  const [quoteContext, setQuoteContext] = useState<QuotePrefillContext>({
    sourceType: null,
    sourcePath: "",
    projectTitle: "",
    projectSlug: "",
    serviceSlug: "",
    serviceLabel: "",
    areaSlug: "",
    location: "",
    ctaLabel: "",
  });
  const [colorPrefill, setColorPrefill] = useState<{ code: string; name: string; brand: string } | null>(null);
  const [successProjects, setSuccessProjects] = useState<QuoteSuccessProject[]>([]);
  const fieldRefs = useRef<Partial<Record<QuoteFieldName, HTMLElement | null>>>({});

  useEffect(() => {
    setUtm(captureUtm());
    setStartedAt(Date.now());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const context = readQuotePrefill(sp);
    setQuoteContext(context);
    setForm((prev) => applyQuotePrefillToForm(prev, context));
    const code = sp.get("color")?.trim();
    const name = sp.get("colorName")?.trim();
    const brand = sp.get("brand")?.trim();
    if (code) setColorPrefill({ code, name: name ?? code, brand: brand ?? "" });
  }, []);

  useEffect(() => {
    if (submitStatus !== "success") return;

    let cancelled = false;
    const service = form.service || quoteContext.serviceSlug || "";
    const params = new URLSearchParams();
    if (service) params.set("service", service);

    fetch(`/api/quote/relevant-projects?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { ok?: boolean; projects?: QuoteSuccessProject[] };
        if (!response.ok || !data.ok || !Array.isArray(data.projects) || cancelled) return;
        setSuccessProjects(data.projects);
      })
      .catch(() => {
        if (!cancelled) setSuccessProjects([]);
      });

    return () => {
      cancelled = true;
    };
  }, [submitStatus, form.service, quoteContext.serviceSlug]);

  const uploadsEnabled = Boolean(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
  );

  function setFieldRef(key: QuoteFieldName, node: HTMLElement | null) {
    fieldRefs.current[key] = node;
  }

  function focusFirstInvalidField(fieldErrors: QuoteFieldErrors) {
    const firstKey = Object.keys(fieldErrors)[0] as QuoteFieldName | undefined;
    if (!firstKey) return;

    const node = fieldRefs.current[firstKey];
    if (!node) return;

    node.scrollIntoView({ behavior: "smooth", block: "center" });
    if ("focus" in node && typeof node.focus === "function") {
      window.setTimeout(() => node.focus({ preventScroll: true }), 150);
    }
  }

  // ── Field setters ─────────────────────────────────────────────────────────

  function set<K extends keyof QuoteFormFields>(key: K, value: QuoteFormFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (submitStatus === "error") setSubmitError("");
  }

  // ── Photo handling ────────────────────────────────────────────────────────

  function addPhotos(files: FileList) {
    const incoming = Array.from(files);
    const remaining = MAX_PHOTOS - photos.length;
    const batch = incoming.slice(0, remaining);
    if (batch.length > 0) {
      trackEvent("quote_photo_upload", { count: batch.length });
    }

    const newStates: PhotoState[] = batch.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      status: "pending",
    }));

    setPhotos((prev) => {
      const updated = [...prev, ...newStates];
      // Start uploads immediately for each new photo
      updated.slice(prev.length).forEach((_, relIdx) => {
        const absIdx = prev.length + relIdx;
        uploadPhoto(absIdx, updated[absIdx]);
      });
      return updated;
    });
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].previewUrl);
      updated.splice(index, 1);
      return updated;
    });
  }

  function uploadPhoto(index: number, photo: PhotoState) {
    if (!uploadsEnabled) return;

    // Validate client-side
    if (!ACCEPTED_TYPES.includes(photo.file.type)) {
      setPhotos((prev) => {
        const updated = [...prev];
        if (updated[index]) {
          updated[index] = { ...updated[index], status: "error", errorMsg: "Unsupported format" };
        }
        return updated;
      });
      return;
    }

    if (photo.file.size > MAX_FILE_MB * 1024 * 1024) {
      setPhotos((prev) => {
        const updated = [...prev];
        if (updated[index]) {
          updated[index] = { ...updated[index], status: "error", errorMsg: `Max ${MAX_FILE_MB}MB` };
        }
        return updated;
      });
      return;
    }

    setPhotos((prev) => {
      const updated = [...prev];
      if (updated[index]) updated[index] = { ...updated[index], status: "uploading" };
      return updated;
    });

    uploadLeadPhoto(photo.file)
      .then((result) => {
        setPhotos((prev) => {
          const updated = [...prev];
          if (updated[index]) {
            updated[index] = { ...updated[index], status: "done", cloudUrl: result.secureUrl };
          }
          return updated;
        });
      })
      .catch(() => {
        setPhotos((prev) => {
          const updated = [...prev];
          if (updated[index]) {
            updated[index] = { ...updated[index], status: "error", errorMsg: "Upload failed" };
          }
          return updated;
        });
      });
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const fieldErrors = validateQuoteFields(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      setSubmitStatus("error");
      setSubmitError("Please fix the highlighted fields and try again.");
      focusFirstInvalidField(fieldErrors);
      return;
    }

    // Wait if any uploads are still in progress
    const stillUploading = photos.some((p) => p.status === "uploading");
    if (stillUploading) {
      setSubmitError("Photos are still uploading. Please wait a moment.");
      setSubmitStatus("error");
      return;
    }

    const photoUrls = photos
      .filter((p) => p.status === "done" && p.cloudUrl)
      .map((p) => p.cloudUrl as string);

    setIsSubmitting(true);
    setSubmitStatus("idle");
    setSubmitError("");

    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          service: form.service,
          location: form.location,
          timeline: form.timeline || undefined,
          budget: form.budget || undefined,
          message: form.message,
          photoUrls,
          consent: form.consent,
          utmSource: utm.utmSource || undefined,
          utmMedium: utm.utmMedium || undefined,
          utmCampaign: utm.utmCampaign || undefined,
          referrer: utm.referrer || undefined,
          sourceType: quoteContext.sourceType || undefined,
          sourcePath: quoteContext.sourcePath || undefined,
          projectTitle: quoteContext.projectTitle || undefined,
          projectSlug: quoteContext.projectSlug || undefined,
          areaSlug: quoteContext.areaSlug || undefined,
          ctaLabel: quoteContext.ctaLabel || undefined,
          honeypot: honeypot || undefined,
          startedAt,
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        ignored?: boolean;
        error?: {
          type?: string;
          message?: string;
          fieldErrors?: QuoteFieldErrors;
        };
      };

      if (!response.ok || !data.ok) {
        if (data.error?.fieldErrors) {
          setErrors(data.error.fieldErrors);
          focusFirstInvalidField(data.error.fieldErrors);
        }
        throw new Error(
          data.error?.message ?? "Unable to submit. Please try again or call us directly.",
        );
      }

      trackEvent("quote_submit", {
        service: form.service,
        utm_source: utm.utmSource || undefined,
        utm_medium: utm.utmMedium || undefined,
        utm_campaign: utm.utmCampaign || undefined,
        source_type: quoteContext.sourceType || undefined,
        project_slug: quoteContext.projectSlug || undefined,
        area_slug: quoteContext.areaSlug || undefined,
      });

      setSuccessProjects([]);
      setSubmitStatus("success");
    } catch (err) {
      setSubmitStatus("error");
      setSubmitError(err instanceof Error ? err.message : "Unable to submit.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (submitStatus === "success") {
    return (
      <main className="bg-cream pt-28 pb-20">
        <div className="mx-auto max-w-4xl px-4 md:px-8">
          <SuccessState service={form.service} context={quoteContext} projects={successProjects} />
        </div>
      </main>
    );
  }

  return (
    <main className="bg-cream pt-28 pb-20">
      <div className="mx-auto max-w-2xl px-4 md:px-8">
        <p className="font-ui text-sm uppercase tracking-[0.18em] text-red">Start with a Quote</p>
        <h1 className="mt-3 text-4xl text-charcoal md:text-5xl">Tell Us About Your Project</h1>
        <p className="mt-4 text-gray-mid">
          Share the basics, add photos if you have them, and we will follow up with the right next
          step for pricing, scheduling, or an on-site visit.
        </p>
        <p className="mt-2 text-sm text-gray-mid">Most homeowners hear back within one business day.</p>
        {colorPrefill ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="font-ui text-[10px] uppercase tracking-[0.18em] text-red shrink-0">Color</p>
            <p className="font-ui text-sm text-charcoal">
              <span className="font-semibold">{colorPrefill.name}</span>
              {" "}
              <span className="text-gray-mid">{colorPrefill.code}</span>
              {colorPrefill.brand ? (
                <span className="text-gray-mid"> · {colorPrefill.brand}</span>
              ) : null}
            </p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-8">
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            className="sr-only"
            aria-hidden="true"
          />
          <input type="hidden" value={startedAt} readOnly />

          {/* ── Section 1: Contact info ────────────────────────────────── */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <SectionLabel>Contact Info</SectionLabel>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div id="field-firstName">
                <label className="block text-sm font-medium text-charcoal">
                  First Name <span className="text-red">*</span>
                </label>
                <input
                  ref={(node) => setFieldRef("firstName", node)}
                  type="text"
                  required
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                  aria-invalid={Boolean(errors.firstName)}
                  aria-describedby={errors.firstName ? "error-firstName" : undefined}
                  className={inputClass(!!errors.firstName)}
                  placeholder="Jane"
                />
                <div id="error-firstName">
                  <FieldError msg={errors.firstName} />
                </div>
              </div>

              <div id="field-lastName">
                <label className="block text-sm font-medium text-charcoal">
                  Last Name <span className="text-red">*</span>
                </label>
                <input
                  ref={(node) => setFieldRef("lastName", node)}
                  type="text"
                  required
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                  aria-invalid={Boolean(errors.lastName)}
                  aria-describedby={errors.lastName ? "error-lastName" : undefined}
                  className={inputClass(!!errors.lastName)}
                  placeholder="Smith"
                />
                <div id="error-lastName">
                  <FieldError msg={errors.lastName} />
                </div>
              </div>

              <div id="field-email" className="sm:col-span-2">
                <label className="block text-sm font-medium text-charcoal">
                  Email <span className="text-red">*</span>
                </label>
                <input
                  ref={(node) => setFieldRef("email", node)}
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "error-email" : undefined}
                  className={inputClass(!!errors.email)}
                  placeholder="jane@example.com"
                />
                <div id="error-email">
                  <FieldError msg={errors.email} />
                </div>
              </div>

              <div id="field-phone" className="sm:col-span-2">
                <label className="block text-sm font-medium text-charcoal">
                  Phone <span className="text-red">*</span>
                </label>
                <PhoneInput
                  id="phone"
                  name="phone"
                  required
                  value={form.phone}
                  onChange={(v) => set("phone", v)}
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? "error-phone" : undefined}
                  className={inputClass(!!errors.phone)}
                />
                <div id="error-phone">
                  <FieldError msg={errors.phone} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 2: Project details ─────────────────────────────── */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <SectionLabel>Project Details</SectionLabel>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div id="field-service">
                <label className="block text-sm font-medium text-charcoal">
                  Service <span className="text-red">*</span>
                </label>
                <select
                  ref={(node) => setFieldRef("service", node)}
                  required
                  value={form.service}
                  onChange={(e) => {
                    set("service", e.target.value);
                    if (e.target.value) {
                      trackEvent("quote_service_select", { service: e.target.value });
                    }
                  }}
                  aria-invalid={Boolean(errors.service)}
                  aria-describedby={errors.service ? "error-service" : undefined}
                  className={inputClass(!!errors.service)}
                >
                  <option value="">Select a service…</option>
                  {SERVICE_OPTIONS.map((opt) => (
                    <option key={opt.slug} value={opt.slug}>
                      {opt.label}
                    </option>
                  ))}
                  <option value="other">Other / Not sure</option>
                </select>
                <div id="error-service">
                  <FieldError msg={errors.service} />
                </div>
              </div>

              <div id="field-location">
                <label className="block text-sm font-medium text-charcoal">
                  Neighborhood / City <span className="text-red">*</span>
                </label>
                <input
                  ref={(node) => setFieldRef("location", node)}
                  type="text"
                  required
                  value={form.location}
                  onChange={(e) => set("location", e.target.value)}
                  aria-invalid={Boolean(errors.location)}
                  aria-describedby={errors.location ? "error-location" : undefined}
                  className={inputClass(!!errors.location)}
                  placeholder="Henderson, NV"
                />
                <div id="error-location">
                  <FieldError msg={errors.location} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal">Timeline</label>
                <select
                  value={form.timeline}
                  onChange={(e) => set("timeline", e.target.value)}
                  className={inputClass(false)}
                >
                  {TIMELINE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal">Budget Range</label>
                <select
                  value={form.budget}
                  onChange={(e) => set("budget", e.target.value)}
                  className={inputClass(false)}
                >
                  {BUDGET_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div id="field-message" className="sm:col-span-2">
                <label className="block text-sm font-medium text-charcoal">
                  Project Description <span className="text-red">*</span>
                </label>
                <textarea
                  ref={(node) => setFieldRef("message", node)}
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) => set("message", e.target.value)}
                  aria-invalid={Boolean(errors.message)}
                  aria-describedby={errors.message ? "error-message" : "message-help"}
                  className={inputClass(!!errors.message)}
                  placeholder="Describe the room, scope, and any dimensions or details you have. The more context, the better."
                />
                <div className="mt-1 flex items-center justify-between text-xs text-gray-mid" id="message-help">
                  <span>Helpful details: room, style, dimensions, and timing.</span>
                  <span>{form.message.length}/2000</span>
                </div>
                <div id="error-message">
                  <FieldError msg={errors.message} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 3: Photos ─────────────────────────────────────── */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <PhotoUploadSection
              photos={photos}
              onAdd={addPhotos}
              onRemove={removePhoto}
              uploadsEnabled={uploadsEnabled}
            />
            {!uploadsEnabled ? (
              <p className="mt-3 text-xs text-gray-mid">
                Photo upload is not configured. You can email photos directly after submitting.
              </p>
            ) : null}
          </div>

          {/* ── Consent + Submit ──────────────────────────────────────── */}
          <div className="space-y-4">
            <div id="field-consent">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  ref={(node) => setFieldRef("consent", node)}
                  type="checkbox"
                  checked={form.consent}
                  onChange={(e) => set("consent", e.target.checked)}
                  aria-invalid={Boolean(errors.consent)}
                  aria-describedby={errors.consent ? "error-consent" : undefined}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 accent-red"
                />
                <span className="text-sm text-charcoal">
                  I agree to be contacted by Sublime Design NV about this quote request.{" "}
                  <span className="text-red">*</span>
                </span>
              </label>
              <div id="error-consent">
                <FieldError msg={errors.consent} />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="font-ui w-full rounded-sm bg-red px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60 sm:w-auto"
            >
              {isSubmitting ? "Sending…" : "Start with a Quote"}
            </button>
            <p className="text-xs text-gray-mid">
              Your details are only used to follow up about this quote request.
            </p>

            {submitStatus === "error" && submitError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {submitError}
              </div>
            ) : null}
          </div>
        </form>

        <p className="mt-8 text-sm text-gray-mid">
          Prefer to call?{" "}
          <a href="tel:+17028479016" className="font-semibold text-red">
            (702) 847-9016
          </a>{" "}
          · Or go back to{" "}
          <Link href="/" className="font-semibold text-red">
            home
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
