"use client";

import exifr from "exifr";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import PaintColorPicker, { type PaintColor } from "@/components/admin/PaintColorPicker";
import MaterialTypePicker, { type MaterialSelection, EMPTY_MATERIAL_SELECTION } from "@/components/admin/MaterialTypePicker";
import PostToGBPButton from "@/components/admin/PostToGBPButton";
import { generateGBPCaption } from "@/lib/generateSocialCaption";
import ServiceMetadataFields from "@/components/admin/ServiceMetadataFields";
import { buildPublicId, uploadFileToCloudinaryWithProgress } from "@/lib/cloudinaryUpload";
import { CONTEXT_TAGS, SERVICE_TAGS } from "@/lib/serviceTags";
import { AREA_NAMES } from "@/content/areas";
import {
  CUT_OPTIONS,
  GRADE_OPTIONS,
  MATERIAL_GRADES,
  PAINT_BRANDS,
  PAINT_GRADE_SUBSTRATES,
  PAINT_SHEENS,
  STAIN_BRANDS,
  STAIN_FINISH_TYPES,
  STAIN_GRADE_SUBSTRATES,
  STAIN_SHEENS,
  WOOD_SPECIES,
  type MaterialGrade,
} from "@/content/materials";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ColorEntry {
  id: string;
  label: string;
  color: PaintColor | null;
  brand: string;
}

type UploadStatus = {
  name: string;
  state: "pending" | "uploading" | "saving" | "success" | "error";
  progress: number;
  message?: string;
  analysis?: "analyzing" | "ready" | "failed";
};

type FilePreview = {
  file: File;
  previewUrl: string;
};

async function createPreviewUrl(file: File): Promise<string> {
  const isHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    file.name.toLowerCase().endsWith(".heic") ||
    file.name.toLowerCase().endsWith(".heif");

  if (isHeic) {
    try {
      const heic2any = (await import("heic2any")).default;
      const blob = (await heic2any({ blob: file, toType: "image/jpeg", quality: 0.5 })) as Blob;
      return URL.createObjectURL(blob);
    } catch (err) {
      console.warn("HEIC conversion failed, using fallback:", err);
      return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNDAiIHk9IjQ0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEwIiBmaWxsPSIjOWNhM2FmIj5IRUlDPC90ZXh0Pjwvc3ZnPg==";
    }
  }

  return URL.createObjectURL(file);
}


// ── EXIF extraction ─────────────────────────────────────────────────────────
// Parse GPS + capture date from the ORIGINAL file before upload. iPhone HEICs work
// with exifr's default parser for EXIF/GPS blocks. Failure to parse must never block
// an upload — every path returns nulls and never throws.

type ExifData = { gpsLat: number | null; gpsLng: number | null; exifTakenAt: string | null };

const EMPTY_EXIF: ExifData = { gpsLat: null, gpsLng: null, exifTakenAt: null };

async function extractExif(file: File): Promise<ExifData> {
  const isImage =
    file.type.startsWith("image/") ||
    /\.(heic|heif|jpe?g|tiff?)$/i.test(file.name);
  if (!isImage) return EMPTY_EXIF;

  const result: ExifData = { ...EMPTY_EXIF };

  try {
    const gps = await exifr.gps(file).catch(() => null);
    if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) {
      result.gpsLat = gps.latitude;
      result.gpsLng = gps.longitude;
    }
  } catch {
    /* ignore — leave GPS null */
  }

  try {
    const meta = (await exifr
      .parse(file, { pick: ["DateTimeOriginal", "CreateDate"] })
      .catch(() => null)) as { DateTimeOriginal?: Date; CreateDate?: Date } | null;
    const taken = meta?.DateTimeOriginal ?? meta?.CreateDate;
    if (taken instanceof Date && !Number.isNaN(taken.getTime())) {
      result.exifTakenAt = taken.toISOString();
    }
  } catch {
    /* ignore — leave date null */
  }

  return result;
}

// ── AI vision auto-analysis (fire-and-forget, max 2 concurrent) ───────────────

async function analyzeAsset(assetId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/admin/assets/${assetId}/analyze`, { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++]!;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

function toTitleCase(str: string) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Clean a raw filename into a human title: drop extension, normalize separators.
function filenameToTitle(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return base ? toTitleCase(base) : "Untitled";
}

function toSlug(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// ── Generic primary/secondary toggle factory ───────────────────────────────────

function makeToggle(
  primary: string,
  setPrimary: (v: string) => void,
  secondary: string[],
  setSecondary: (fn: (prev: string[]) => string[]) => void,
) {
  return (val: string) => {
    if (val === primary) {
      setPrimary(secondary[0] ?? "");
      setSecondary((prev) => prev.slice(1));
    } else if (secondary.includes(val)) {
      setSecondary((prev) => prev.filter((s) => s !== val));
    } else if (!primary) {
      setPrimary(val);
    } else {
      setSecondary((prev) => [...prev, val]);
    }
  };
}

// ── Accordion ──────────────────────────────────────────────────────────────────

function AccordionSection({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-gray-200">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between bg-white px-4 py-3 transition-colors hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <span className="font-ui text-sm font-semibold text-gray-900">{title}</span>
          {badge != null && badge > 0 && (
            <span className="rounded-full bg-red px-2 py-0.5 font-ui text-xs font-bold text-white">
              {badge}
            </span>
          )}
        </div>
        <svg
          className="h-4 w-4 text-gray-400 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-gray-100 bg-white px-4 py-4">{children}</div>
      )}
    </div>
  );
}

// ── ChipGroup — primary (solid red) + secondary (red outline) ──────────────────

function ChipGroup({
  options,
  primary,
  secondary,
  onToggle,
}: {
  options: string[];
  primary: string;
  secondary: string[];
  onToggle: (val: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isPrimary = opt === primary;
        const isSecondary = secondary.includes(opt);
        const isSelected = isPrimary || isSecondary;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className="rounded-full border px-3 py-1.5 font-ui text-sm font-medium transition-colors"
            style={{
              backgroundColor: isPrimary ? "#CC2027" : "white",
              color: isPrimary ? "white" : isSecondary ? "#CC2027" : "#374151",
              borderColor: isSelected ? "#CC2027" : "#d1d5db",
            }}
          >
            {opt}
            {isSecondary && <span className="ml-1 text-xs opacity-70">+</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── SimpleChips — single-select or multi-select (no primary/secondary) ─────────

function SimpleChips({
  options,
  selected,
  onToggle,
  multi = false,
}: {
  options: string[];
  selected: string | string[];
  onToggle: (val: string) => void;
  multi?: boolean;
}) {
  const isActive = (opt: string) =>
    multi ? (selected as string[]).includes(opt) : selected === opt;

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onToggle(opt)}
          className="rounded-full border px-3 py-1.5 font-ui text-sm font-medium transition-colors"
          style={{
            backgroundColor: isActive(opt) ? "#CC2027" : "white",
            color: isActive(opt) ? "white" : "#374151",
            borderColor: isActive(opt) ? "#CC2027" : "#d1d5db",
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ── CategoryLabel ──────────────────────────────────────────────────────────────

function CategoryLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 font-ui text-xs font-semibold uppercase tracking-[0.16em] text-gray-mid">
      {children}
    </p>
  );
}

// ── ColorEntryRow ──────────────────────────────────────────────────────────────

function ColorEntryRow({
  entry,
  availableBrands,
  onUpdate,
  onRemove,
  canRemove,
}: {
  entry: ColorEntry;
  availableBrands: string[];
  onUpdate: (id: string, updates: Partial<ColorEntry>) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={entry.label}
          onChange={(e) => onUpdate(entry.id, { label: e.target.value })}
          placeholder="What is this color for? e.g. Cabinets, Island, Walls"
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 font-ui text-sm text-charcoal outline-none transition focus:border-navy"
        />
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(entry.id)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            ✕
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {availableBrands.map((brand) => (
          <button
            key={brand}
            type="button"
            onClick={() => onUpdate(entry.id, { brand, color: null })}
            className="rounded-full border px-2.5 py-1 font-ui text-xs font-medium transition-colors"
            style={{
              backgroundColor: entry.brand === brand ? "#1B2A6B" : "white",
              color: entry.brand === brand ? "white" : "#374151",
              borderColor: entry.brand === brand ? "#1B2A6B" : "#d1d5db",
            }}
          >
            {brand}
          </button>
        ))}
      </div>
      <PaintColorPicker
        brand={entry.brand}
        selected={entry.color}
        onSelect={(color) => onUpdate(entry.id, { color })}
        placeholder={`Search ${entry.brand} colors...`}
      />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AssetUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchSectionRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  // Files
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [converting, setConverting] = useState(false);

  // FM integration

  // Service
  const [primaryService, setPrimaryService] = useState("");
  const [secondaryServices, setSecondaryServices] = useState<string[]>([]);

  // Location
  const [primaryLocation, setPrimaryLocation] = useState("");
  const [secondaryLocations, setSecondaryLocations] = useState<string[]>([]);
  const [locationOther, setLocationOther] = useState("");

  // Rooms
  const [primaryRoom, setPrimaryRoom] = useState("");
  const [secondaryRooms, setSecondaryRooms] = useState<string[]>([]);

  // Features
  const [primaryFeature, setPrimaryFeature] = useState("");
  const [secondaryFeatures, setSecondaryFeatures] = useState<string[]>([]);

  // Material — three-path system
  const [materialGrade, setMaterialGrade] = useState<MaterialGrade | "">("");
  const [materialSelection, setMaterialSelection] = useState<MaterialSelection>(EMPTY_MATERIAL_SELECTION);
  const [selectedSubstrates, setSelectedSubstrates] = useState<string[]>([]);
  const [selectedSheen, setSelectedSheen] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [stainFinishType, setStainFinishType] = useState("");
  const [selectedGrade, setSelectedGrade] = useState<string[]>([]);
  const [selectedCut, setSelectedCut] = useState<string[]>([]);
  const [primaryWoodSpecies, setPrimaryWoodSpecies] = useState("");
  const [secondaryWoodSpecies, setSecondaryWoodSpecies] = useState<string[]>([]);

  // Color entries — multi-color system for Paint + Stain paths
  const [colorEntries, setColorEntries] = useState<ColorEntry[]>([
    { id: crypto.randomUUID(), label: "", color: null, brand: "Sherwin-Williams" },
  ]);

  // File info
  const [filenameOverride, setFilenameOverride] = useState("");
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [descTab, setDescTab] = useState<"short" | "seo">("short");

  // Misc
  const [serviceMetadata, setServiceMetadata] = useState<Record<string, unknown>>({});
  const [published, setPublished] = useState(false);
  const [setAsHero, setSetAsHero] = useState(false);
  const [quickUpload, setQuickUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statuses, setStatuses] = useState<UploadStatus[]>([]);
  const [lastCompletedBatch, setLastCompletedBatch] = useState<{
    uploadBatchId: string;
    assetIds: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const resolvedLocation = primaryLocation === "Other" ? locationOther : primaryLocation;
  const primaryServiceLabel = SERVICE_TAGS.find((s) => s.slug === primaryService)?.label ?? "";
  const secondaryServiceLabels = secondaryServices
    .map((slug) => SERVICE_TAGS.find((s) => s.slug === slug)?.label)
    .filter((l): l is string => Boolean(l));

  const roomLabels = CONTEXT_TAGS.filter((c) => c.group === "room").map((c) => c.label);
  const featureLabels = CONTEXT_TAGS.filter((c) => c.group === "feature").map((c) => c.label);

  const totalServiceCount = (primaryService ? 1 : 0) + secondaryServices.length;
  const locationBadge = (primaryLocation ? 1 : 0) + secondaryLocations.length;
  const contextBadge =
    (primaryRoom ? 1 : 0) + secondaryRooms.length +
    (primaryFeature ? 1 : 0) + secondaryFeatures.length;
  const materialBadge = materialGrade
    ? 1 + selectedSubstrates.length + (selectedSheen ? 1 : 0) + (selectedBrand ? 1 : 0)
    : 0;
  const metadataBadge = Object.values(serviceMetadata).filter(Boolean).length;

  const autoFilename = useMemo(() => {
    const parts: string[] = [];
    if (primaryServiceLabel) parts.push(primaryServiceLabel);
    if (primaryRoom) parts.push(primaryRoom);
    else if (primaryFeature) parts.push(primaryFeature);
    if (resolvedLocation) parts.push(resolvedLocation);
    if (primaryWoodSpecies) parts.push(primaryWoodSpecies);
    const firstColor = colorEntries?.find((e) => e.color !== null);
    if (firstColor?.color?.name) parts.push(firstColor.color.name);
    return toSlug(parts.join("-")).slice(0, 60) || "untitled";
  }, [primaryServiceLabel, primaryRoom, primaryFeature, resolvedLocation, primaryWoodSpecies, colorEntries]);

  const finalFilename = filenameOverride.trim() || autoFilename;

  const autoAlt = [primaryServiceLabel, primaryRoom || primaryFeature, resolvedLocation, "Las Vegas"]
    .filter(Boolean).join(" ");
  const autoTitle = toTitleCase(autoAlt);

  const hasVideo = files.some((f) => f.type.startsWith("video/"));
  const previewPublicId =
    primaryService && resolvedLocation
      ? buildPublicId({ serviceType: primaryService, location: resolvedLocation, descriptor: finalFilename, isVideo: hasVideo && files.length === 1 })
      : null;

  // Context slugs for API
  const allContextLabels = [primaryRoom, ...secondaryRooms, primaryFeature, ...secondaryFeatures].filter(Boolean);
  const contextSlugs = allContextLabels
    .map((label) => CONTEXT_TAGS.find((c) => c.label === label)?.slug)
    .filter((s): s is string => Boolean(s));

  // Flatten material selections for API (materials String[])
  const allMaterials = [
    materialGrade,
    ...selectedSubstrates,
    selectedSheen,
    selectedBrand,
    stainFinishType,
    ...selectedGrade,
    ...selectedCut,
    primaryWoodSpecies,
    ...secondaryWoodSpecies,
    ...colorEntries.flatMap((e) =>
      e.color ? [e.label || "Unlabeled", e.color.name, e.color.code] : [],
    ),
  ].filter(Boolean);

  const canUpload =
    files.length > 0 &&
    !isUploading &&
    (quickUpload || (Boolean(primaryService) && Boolean(resolvedLocation)));

  // ── Toggles ───────────────────────────────────────────────────────────────────

  function toggleService(label: string) {
    const service = SERVICE_TAGS.find((s) => s.label === label);
    if (!service) return;
    const slug = service.slug;
    if (slug === primaryService) {
      const next = secondaryServices[0] ?? "";
      setPrimaryService(next);
      setSecondaryServices((prev) => prev.slice(1));
      if (!next) setServiceMetadata({});
      try { localStorage.setItem("lastUsedServiceType", next); } catch {}
    } else if (secondaryServices.includes(slug)) {
      setSecondaryServices((prev) => prev.filter((s) => s !== slug));
    } else if (!primaryService) {
      setPrimaryService(slug);
      setServiceMetadata({});
      try { localStorage.setItem("lastUsedServiceType", slug); } catch {}
    } else {
      setSecondaryServices((prev) => [...prev, slug]);
    }
  }

  const toggleLocation = makeToggle(primaryLocation, setPrimaryLocation, secondaryLocations, setSecondaryLocations);
  const toggleRoom = makeToggle(primaryRoom, setPrimaryRoom, secondaryRooms, setSecondaryRooms);
  const toggleFeature = makeToggle(primaryFeature, setPrimaryFeature, secondaryFeatures, setSecondaryFeatures);
  const toggleWoodSpecies = makeToggle(primaryWoodSpecies, setPrimaryWoodSpecies, secondaryWoodSpecies, setSecondaryWoodSpecies);

  function toggleSubstrate(val: string) {
    setSelectedSubstrates((prev) =>
      prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val],
    );
  }

  function updateColorEntry(id: string, updates: Partial<ColorEntry>) {
    setColorEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  }

  function removeColorEntry(id: string) {
    setColorEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function addColorEntry(defaultBrand: string) {
    setColorEntries((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: "", color: null, brand: defaultBrand },
    ]);
  }

  // ── Effects ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lastUsedServiceType");
      if (saved) setPrimaryService(saved);
    } catch { /* ignore */ }
  }, []);

  // Pre-populate from FM deep-link URL params
  useEffect(() => {
    const service = searchParams.get("service");
    const location = searchParams.get("location");

    const notes = searchParams.get("notes");
    if (service) setPrimaryService(service);
    if (location) setPrimaryLocation(location);
    if (notes) { setDescription(notes); setShortDescription(notes); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!titleEdited && autoTitle) setTitle(autoTitle);
  }, [autoTitle, titleEdited]);

  useEffect(() => {
    setServiceMetadata({});
  }, [primaryService]);

  // Reset all material state when grade path changes
  useEffect(() => {
    setSelectedSubstrates([]);
    setSelectedSheen("");
    setSelectedBrand("");
    setStainFinishType("");
    setSelectedGrade([]);
    setSelectedCut([]);
    setPrimaryWoodSpecies("");
    setSecondaryWoodSpecies([]);
    setMaterialSelection(EMPTY_MATERIAL_SELECTION);
    setColorEntries([{ id: crypto.randomUUID(), label: "", color: null, brand: "Sherwin-Williams" }]);
  }, [materialGrade]);

  // Keep a ref to current previews so the unmount cleanup always has the latest list
  const previewsRef = useRef(previews);
  useEffect(() => { previewsRef.current = previews; }, [previews]);
  useEffect(() => {
    return () => {
      previewsRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  // ── File helpers ──────────────────────────────────────────────────────────────

  async function addFiles(selected: File[]) {
    if (!selected.length) return;
    setFiles((prev) => [...prev, ...selected]);
    setConverting(true);
    const newPreviews = await Promise.all(
      selected.map(async (f) => ({ file: f, previewUrl: await createPreviewUrl(f) }))
    );
    setPreviews((prev) => [...prev, ...newPreviews]);
    setConverting(false);
  }

  function removeFile(index: number) {
    if (previews[index]?.previewUrl) URL.revokeObjectURL(previews[index].previewUrl);
    setFiles((f) => f.filter((_, i) => i !== index));
    setPreviews((p) => p.filter((_, i) => i !== index));
  }

  function updateStatus(name: string, next: Partial<UploadStatus>) {
    setStatuses((current) => current.map((item) => (item.name === name ? { ...item, ...next } : item)));
  }

  // ── Submit ────────────────────────────────────────────────────────────────────

  async function handleGenerateDescription() {
    setGeneratingDesc(true);
    try {
      const res = await fetch("/api/admin/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryService: primaryServiceLabel || undefined,
          secondaryServices: secondaryServices.length ? secondaryServices : undefined,
          primaryLocation: resolvedLocation || undefined,
          primaryRoom: primaryRoom || undefined,
          primaryFeature: primaryFeature || undefined,
          materialGrade: materialGrade || undefined,
          woodSpeciesPrimary: primaryWoodSpecies || undefined,
          colorEntries,
          serviceMetadata: Object.keys(serviceMetadata).length ? serviceMetadata : undefined,
          sheen: selectedSheen || undefined,
          substrate: selectedSubstrates.length ? selectedSubstrates : undefined,
          finishType: stainFinishType || undefined,
        }),
      });
      const data = await res.json() as { short?: string; seo?: string };
      if (data.short) setShortDescription(data.short);
      if (data.seo) setSeoDescription(data.seo);
      setDescTab("short");
    } catch (err) {
      console.error("Description generation failed:", err);
    } finally {
      setGeneratingDesc(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!canUpload) return;

    setIsUploading(true);
    setStatuses(files.map((file) => ({ name: file.name, state: "pending", progress: 0 })));

    const uploadBatchId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
    const createdAssetIds: string[] = [];
    const analysisTasks: { assetId: string; fileName: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      try {
        updateStatus(file.name, { state: "uploading", progress: 0 });

        const isVideo = file.type.startsWith("video/");
        const basePublicId = quickUpload
          ? buildPublicId({
              serviceType: "Inbox",
              location: "",
              descriptor: file.name.replace(/\.[^.]+$/, "") || `photo-${i + 1}`,
              isVideo,
            })
          : buildPublicId({
              serviceType: primaryService,
              location: resolvedLocation,
              descriptor: finalFilename,
              isVideo,
            });
        const publicId = i === 0 ? basePublicId : `${basePublicId}-${i + 1}`;

        // Parse EXIF from the original file before upload (never blocks on failure)
        const exif = await extractExif(file).catch(() => EMPTY_EXIF);

        const uploadResult = await uploadFileToCloudinaryWithProgress(
          file,
          (percent) => updateStatus(file.name, { progress: percent }),
          { publicId },
        );

        updateStatus(file.name, { state: "saving", progress: 95 });

        const tagSlugs = [primaryService, ...secondaryServices].filter(Boolean);
        const saveBodyJson = quickUpload
          ? {
              // Quick upload — only files + EXIF; AI tags, Brandon reviews later.
              ...uploadResult,
              uploadBatchId,
              quickUpload: true,
              title: filenameToTitle(file.name),
              gpsLat: exif.gpsLat,
              gpsLng: exif.gpsLng,
              exifTakenAt: exif.exifTakenAt,
            }
          : {
              ...uploadResult,
              uploadBatchId,
              title: title.trim() || autoTitle,
              alt: autoAlt,
              description: seoDescription.trim() || shortDescription.trim() || description.trim() || undefined,
              shortDescription: shortDescription.trim() || undefined,
              seoDescription: seoDescription.trim() || undefined,
              location: resolvedLocation || undefined,
              primaryServiceSlug: primaryService,
              serviceMetadata,
              gpsLat: exif.gpsLat,
              gpsLng: exif.gpsLng,
              exifTakenAt: exif.exifTakenAt,
              published,
              tagSlugs,
              contextSlugs,
              materials: allMaterials,
              materialCategoryId: materialSelection.categoryId || undefined,
              assetManufacturerId: materialSelection.manufacturerId || undefined,
              assetSupplierId: materialSelection.supplierId || undefined,
              assetMaterialId: materialSelection.materialId || undefined,
              materialSheen: materialSelection.sheen || undefined,
            };
        const saveResponse = await fetch("/api/admin/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(saveBodyJson),
        });

        const saveBody = (await saveResponse.json().catch(() => ({}))) as {
          error?: string;
          asset?: { id?: string };
        };

        if (!saveResponse.ok) throw new Error(saveBody.error || "Failed to save photo metadata.");
        const assetId = saveBody.asset?.id;
        if (assetId) {
          createdAssetIds.push(assetId);
          analysisTasks.push({ assetId, fileName: file.name });
          // Set as hero for the service if requested (first file only)
          if (setAsHero && i === 0) {
            await fetch(`/api/admin/assets/${assetId}/hero`, { method: "POST" }).catch(() => null);
          }
          // Link tagged paint colors to the new asset
          const colorIds = colorEntries.map((e) => e.color?.id).filter(Boolean) as string[];
          for (const paintColorId of colorIds) {
            await fetch(`/api/admin/assets/${assetId}/colors`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paintColorId }),
            }).catch(() => null);
          }
        }
        updateStatus(file.name, { state: "success", progress: 100 });
      } catch (uploadError) {
        updateStatus(file.name, {
          state: "error",
          progress: 0,
          message: uploadError instanceof Error ? uploadError.message : "Unknown upload error.",
        });
      }
    }

    setIsUploading(false);
    window.dispatchEvent(new Event("admin-assets-refresh"));

    // Fire-and-forget AI vision analysis (max 2 concurrent). Never affects upload result.
    if (analysisTasks.length > 0) {
      analysisTasks.forEach((t) => updateStatus(t.fileName, { analysis: "analyzing" }));
      void runWithConcurrency(analysisTasks, 2, async (t) => {
        const ok = await analyzeAsset(t.assetId);
        updateStatus(t.fileName, { analysis: ok ? "ready" : "failed" });
      });
    }

    if (createdAssetIds.length > 0) {
      setLastCompletedBatch({ uploadBatchId, assetIds: createdAssetIds });
      window.dispatchEvent(
        new CustomEvent("admin-assets-created", {
          detail: { assetIds: createdAssetIds, uploadBatchId },
        }),
      );
      setTimeout(() => {
        batchSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 400);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <section className="rounded-lg border border-gray-warm bg-white p-4 shadow-sm md:p-6">
      <h2 className="text-2xl text-charcoal">Upload Media</h2>

      {/* Drop zone */}
      <div className="mt-5">
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            addFiles(Array.from(e.dataTransfer.files));
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
            isDragging ? "border-red bg-red/5"
              : files.length > 0 ? "border-navy/30 bg-navy/[0.03]"
              : "border-gray-warm hover:border-navy/40"
          }`}
        >
          <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,.heic,.heif" className="hidden"
            onChange={(e) => {
              addFiles(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
          <>
            <svg className="mb-3 h-8 w-8 text-gray-mid" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="font-ui text-sm font-semibold text-charcoal">
              {files.length > 0 ? "Click or drag to add more files" : "Drag photos or videos here, or click to browse"}
            </p>
            <p className="mt-1 font-ui text-xs text-gray-mid">Images and videos accepted — multiple files at once</p>
            {converting && (
              <p className="mt-2 font-ui text-xs text-gray-400">Converting HEIC files...</p>
            )}
          </>
        </div>
        {/* Preview strip — outside the drop zone so clicks don't re-trigger file picker */}
        {previews.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {previews.map((p, index) => (
              <div
                key={index}
                className="relative flex-shrink-0"
                style={{ width: 80, height: 80 }}
              >
                {p.file.type.startsWith("video/") ? (
                  <video
                    src={p.previewUrl}
                    className="h-full w-full rounded-lg object-cover bg-gray-900"
                    muted
                    playsInline
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.previewUrl}
                    alt={p.file.name}
                    className="h-full w-full rounded-lg object-cover bg-gray-100"
                    style={{ display: "block" }}
                  />
                )}
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-black/60 text-white"
                  style={{ fontSize: 10, padding: "2px 4px", textAlign: "center" }}
                >
                  {(p.file.size / 1024 / 1024).toFixed(1)}MB
                </div>
                {!isUploading && (
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: "rgba(0,0,0,0.7)", fontSize: 14, lineHeight: 1 }}
                    aria-label="Remove file"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {files.length > 0 && (
          <p className="mt-1.5 font-ui text-xs text-gray-mid">
            {files.length} file{files.length !== 1 ? "s" : ""} selected — click zone to add more
          </p>
        )}
      </div>

      <form className="mt-4 space-y-2" onSubmit={handleSubmit}>

        {/* Quick upload toggle */}
        <label
          className="flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-colors"
          style={{ borderColor: quickUpload ? "#1B2A6B" : "#e5e7eb", backgroundColor: quickUpload ? "rgba(27,42,107,0.04)" : "white" }}
        >
          <input
            type="checkbox"
            checked={quickUpload}
            onChange={(e) => setQuickUpload(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300"
            style={{ accentColor: "#1B2A6B" }}
          />
          <span>
            <span className="font-ui text-sm font-semibold text-charcoal">⚡ Quick upload — let AI tag, review later</span>
            <span className="mt-0.5 block font-ui text-xs text-gray-mid">
              Drop photos and upload now. AI suggests tags; you approve them in the Review queue. No service or location required.
            </span>
          </span>
        </label>

        {!quickUpload && (
        <>
        {/* 1 — Location */}
        <AccordionSection title="Location" badge={locationBadge} defaultOpen>
          <ChipGroup
            options={[...AREA_NAMES]}
            primary={primaryLocation}
            secondary={secondaryLocations}
            onToggle={(val) => {
              if (val === "Other" && primaryLocation !== "Other") setLocationOther("");
              toggleLocation(val);
            }}
          />
          {(primaryLocation === "Other" || secondaryLocations.includes("Other")) && (
            <input
              type="text"
              value={locationOther}
              onChange={(e) => setLocationOther(e.target.value)}
              className="mt-3 w-full rounded-sm border border-gray-warm bg-white px-3 py-2 font-ui text-sm text-charcoal outline-none transition focus:border-navy"
              placeholder="Enter location"
            />
          )}
        </AccordionSection>

        {/* 2 — Service + inline Service Details */}
        <AccordionSection title="Service" badge={totalServiceCount + metadataBadge} defaultOpen>
          <ChipGroup
            options={SERVICE_TAGS.map((s) => s.label)}
            primary={primaryServiceLabel}
            secondary={secondaryServiceLabels}
            onToggle={toggleService}
          />
          {secondaryServiceLabels.length > 0 && (
            <p className="mt-2 font-ui text-xs text-gray-mid">
              Primary: <strong>{primaryServiceLabel}</strong> · Also: {secondaryServiceLabels.join(", ")}
            </p>
          )}
          {primaryService && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <ServiceMetadataFields
                service={primaryService}
                values={serviceMetadata}
                onChange={(key, value) => setServiceMetadata((c) => ({ ...c, [key]: value }))}
              />
            </div>
          )}
        </AccordionSection>

        {/* 3 — Project Context */}
        <AccordionSection title="Project Context" badge={contextBadge}>
          <div className="space-y-4">
            <div>
              <CategoryLabel>Rooms</CategoryLabel>
              <ChipGroup
                options={roomLabels}
                primary={primaryRoom}
                secondary={secondaryRooms}
                onToggle={toggleRoom}
              />
            </div>
            <div>
              <CategoryLabel>Features</CategoryLabel>
              <ChipGroup
                options={featureLabels}
                primary={primaryFeature}
                secondary={secondaryFeatures}
                onToggle={toggleFeature}
              />
            </div>
          </div>
        </AccordionSection>

        {/* 4 — Material Type — three-path */}
        <AccordionSection title="Material Type" badge={materialBadge}>
          {/* Grade toggle */}
          <div className="mb-5">
            <CategoryLabel>Grade</CategoryLabel>
            <div className="flex flex-wrap gap-2">
              {MATERIAL_GRADES.map((grade) => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => setMaterialGrade(grade === materialGrade ? "" : grade)}
                  className="rounded-full border px-4 py-2 font-ui text-sm font-semibold transition-colors"
                  style={{
                    backgroundColor: materialGrade === grade ? "#1B2A6B" : "white",
                    color: materialGrade === grade ? "white" : "#374151",
                    borderColor: materialGrade === grade ? "#1B2A6B" : "#d1d5db",
                  }}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>

          {/* Empty state */}
          {!materialGrade && (
            <p className="font-ui text-sm text-gray-400">
              Select Paint Grade, Stain Grade, or TFL / Melamine to see relevant options.
            </p>
          )}

          {/* ── Paint Grade path ── */}
          {materialGrade === "Paint Grade" && (
            <div className="space-y-5">
              <div>
                <CategoryLabel>Substrate</CategoryLabel>
                <SimpleChips
                  options={PAINT_GRADE_SUBSTRATES}
                  selected={selectedSubstrates}
                  onToggle={toggleSubstrate}
                  multi
                />
              </div>
              <div>
                <CategoryLabel>Sheen Level</CategoryLabel>
                <SimpleChips
                  options={PAINT_SHEENS.map((s) => `${s.name} — ${s.value}`)}
                  selected={selectedSheen}
                  onToggle={(val) => setSelectedSheen(selectedSheen === val ? "" : val)}
                />
              </div>
              <div>
                <CategoryLabel>Paint Brand</CategoryLabel>
                <SimpleChips
                  options={PAINT_BRANDS}
                  selected={selectedBrand}
                  onToggle={(val) => setSelectedBrand(selectedBrand === val ? "" : val)}
                />
              </div>
              {/* Paint Colors */}
              <div className="space-y-3 border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-ui text-xs font-semibold uppercase tracking-[0.16em] text-gray-700">Paint Colors</p>
                    <p className="mt-0.5 font-ui text-xs text-gray-400">Add a color for each element. Label what it was used on.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addColorEntry("Sherwin-Williams")}
                    className="rounded-full border px-3 py-1.5 font-ui text-xs font-semibold transition-colors"
                    style={{ color: "#CC2027", borderColor: "#CC2027" }}
                  >
                    + Add Color
                  </button>
                </div>
                <div className="space-y-2">
                  {colorEntries.map((entry) => (
                    <ColorEntryRow
                      key={entry.id}
                      entry={entry}
                      availableBrands={PAINT_BRANDS}
                      onUpdate={updateColorEntry}
                      onRemove={removeColorEntry}
                      canRemove={colorEntries.length > 1}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Stain Grade path ── */}
          {materialGrade === "Stain Grade" && (
            <div className="space-y-5">
              <div>
                <CategoryLabel>Wood Species</CategoryLabel>
                <ChipGroup
                  options={WOOD_SPECIES}
                  primary={primaryWoodSpecies}
                  secondary={secondaryWoodSpecies}
                  onToggle={toggleWoodSpecies}
                />
                {secondaryWoodSpecies.length > 0 && (
                  <p className="mt-1 font-ui text-xs text-gray-400">
                    Primary: <strong>{primaryWoodSpecies}</strong> · Also: {secondaryWoodSpecies.join(", ")}
                  </p>
                )}
              </div>
              <div>
                <CategoryLabel>Substrate</CategoryLabel>
                <SimpleChips
                  options={STAIN_GRADE_SUBSTRATES}
                  selected={selectedSubstrates}
                  onToggle={toggleSubstrate}
                  multi
                />
              </div>
              <div>
                <CategoryLabel>Grade</CategoryLabel>
                <SimpleChips
                  options={GRADE_OPTIONS}
                  selected={selectedGrade}
                  onToggle={(val) =>
                    setSelectedGrade((prev) =>
                      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val],
                    )
                  }
                  multi
                />
              </div>
              <div>
                <CategoryLabel>Cut</CategoryLabel>
                <SimpleChips
                  options={CUT_OPTIONS}
                  selected={selectedCut}
                  onToggle={(val) =>
                    setSelectedCut((prev) =>
                      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val],
                    )
                  }
                  multi
                />
              </div>
              <div>
                <CategoryLabel>Finish Type</CategoryLabel>
                <select
                  value={stainFinishType}
                  onChange={(e) => setStainFinishType(e.target.value)}
                  className="w-full rounded-sm border border-gray-warm bg-white px-3 py-2 font-ui text-sm text-charcoal outline-none transition focus:border-navy"
                >
                  <option value="">Select finish type...</option>
                  {STAIN_FINISH_TYPES.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div>
                <CategoryLabel>Sheen Level</CategoryLabel>
                <SimpleChips
                  options={STAIN_SHEENS.map((s) => `${s.name} — ${s.value}`)}
                  selected={selectedSheen}
                  onToggle={(val) => setSelectedSheen(selectedSheen === val ? "" : val)}
                />
              </div>
              <div>
                <CategoryLabel>Finish Brand</CategoryLabel>
                <SimpleChips
                  options={STAIN_BRANDS}
                  selected={selectedBrand}
                  onToggle={(val) => setSelectedBrand(selectedBrand === val ? "" : val)}
                />
              </div>
              {/* Stain Colors */}
              <div className="space-y-3 border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-ui text-xs font-semibold uppercase tracking-[0.16em] text-gray-700">Stain Colors</p>
                    <p className="mt-0.5 font-ui text-xs text-gray-400">Add a color for each element. Label what it was used on.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addColorEntry("General Finishes")}
                    className="rounded-full border px-3 py-1.5 font-ui text-xs font-semibold transition-colors"
                    style={{ color: "#CC2027", borderColor: "#CC2027" }}
                  >
                    + Add Color
                  </button>
                </div>
                <div className="space-y-2">
                  {colorEntries.map((entry) => (
                    <ColorEntryRow
                      key={entry.id}
                      entry={entry}
                      availableBrands={STAIN_BRANDS}
                      onUpdate={updateColorEntry}
                      onRemove={removeColorEntry}
                      canRemove={colorEntries.length > 1}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TFL / Melamine path ── */}
          {materialGrade === "TFL / Melamine" && (
            <MaterialTypePicker
              value={materialSelection}
              onChange={setMaterialSelection}
            />
          )}
        </AccordionSection>

        {/* 5 — Description & Notes */}
        <div className="overflow-hidden rounded-xl border-2" style={{ borderColor: "#1B2A6B" }}>
        <AccordionSection title="✦ AI Description" badge={shortDescription || seoDescription ? 1 : 0}>
          <div className="space-y-3">
            {/* AI generate button */}
            <button
              type="button"
              onClick={handleGenerateDescription}
              disabled={generatingDesc || !primaryService}
              className="flex items-center gap-2 rounded-lg px-4 py-2 font-ui text-sm font-semibold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: generatingDesc ? "#9ca3af" : "#1B2A6B" }}
            >
              {generatingDesc ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Generating…
                </>
              ) : (
                "✦ Generate from Metadata"
              )}
            </button>
            {!primaryService && (
              <p className="font-ui text-xs text-gray-400">Select a service above to generate a description.</p>
            )}

            {/* Tab view after generation */}
            {(shortDescription || seoDescription) ? (
              <>
                <div className="-mb-px flex gap-1 border-b border-gray-200">
                  {(["short", "seo"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setDescTab(tab)}
                      className="px-3 py-1.5 font-ui text-xs font-semibold capitalize transition-colors"
                      style={{
                        borderBottom: `2px solid ${descTab === tab ? "#CC2027" : "transparent"}`,
                        color: descTab === tab ? "#CC2027" : "#6b7280",
                      }}
                    >
                      {tab === "short" ? "Social / Short" : "SEO / Long"}
                    </button>
                  ))}
                </div>
                <textarea
                  value={descTab === "short" ? shortDescription : seoDescription}
                  onChange={(e) => {
                    if (descTab === "short") setShortDescription(e.target.value);
                    else setSeoDescription(e.target.value);
                  }}
                  rows={4}
                  className="w-full rounded-sm border border-gray-warm bg-white px-3 py-2 font-ui text-sm text-charcoal outline-none transition focus:border-navy resize-none"
                  placeholder="Edit the generated description if needed…"
                />
                <p className="font-ui text-xs text-gray-400">
                  Both versions saved. Short for social posts, SEO version for portfolio pages.
                </p>
              </>
            ) : (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[80px] w-full rounded-sm border border-gray-warm bg-white px-3 py-2 font-ui text-sm text-charcoal outline-none transition focus:border-navy"
                placeholder="Short scope summary, finish notes, or install details"
              />
            )}
          </div>
        </AccordionSection>
        </div>

        {/* 6 — File Info */}
        <AccordionSection title="File Info">
          <div className="space-y-4">
            <div>
              <CategoryLabel>Auto Filename</CategoryLabel>
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <span className="flex-1 font-mono text-sm text-gray-700">{finalFilename}</span>
                <span className="font-ui text-xs text-gray-400">.jpg / .mp4</span>
              </div>
              {previewPublicId && (
                <p className="mt-1 rounded-sm bg-navy/5 px-3 py-1.5 font-mono text-[11px] text-navy">
                  📁 {previewPublicId}
                </p>
              )}
              <p className="mt-1 font-ui text-xs text-gray-400">
                Generated from your selections. Override below if needed.
              </p>
            </div>
            <div>
              <CategoryLabel>Override Filename <span className="font-normal normal-case">(optional)</span></CategoryLabel>
              <input
                type="text"
                value={filenameOverride}
                onChange={(e) => setFilenameOverride(e.target.value)}
                className="w-full rounded-sm border border-gray-warm bg-white px-3 py-2 font-ui text-sm text-charcoal outline-none transition focus:border-navy"
                placeholder="Leave blank to use auto filename"
              />
            </div>
            <div>
              <CategoryLabel>Title</CategoryLabel>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setTitleEdited(true); }}
                onBlur={() => { if (!title.trim()) setTitleEdited(false); }}
                className="w-full rounded-sm border border-gray-warm bg-white px-3 py-2.5 font-ui text-sm text-charcoal outline-none transition focus:border-navy"
                placeholder="Auto-generated from selections"
              />
            </div>
          </div>
        </AccordionSection>
        </>
        )}

        {/* Review bar + upload */}
        {error && <p className="font-ui text-sm text-red">{error}</p>}

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <p className="font-ui text-sm font-semibold text-gray-900">Review Before Uploading</p>
          <div className="grid grid-cols-2 gap-2 font-ui text-xs text-gray-600">
            <div><span className="font-semibold">Service:</span> {primaryServiceLabel || "—"}</div>
            <div><span className="font-semibold">Location:</span> {resolvedLocation || "—"}</div>
            <div><span className="font-semibold">Filename:</span> <span className="font-mono">{finalFilename}</span></div>
            <div><span className="font-semibold">Files:</span> {files.length} selected</div>
          </div>
          {quickUpload ? (
            <p className="font-ui text-xs text-navy">
              ⚡ Quick mode: uploaded unpublished and queued for AI tagging. Approve in Review to publish.
            </p>
          ) : (
            <>
              <label className="flex cursor-pointer items-center gap-2 font-ui text-sm text-charcoal">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                  className="rounded border-gray-300 accent-red"
                />
                Publish immediately
              </label>
              <label className="flex cursor-pointer items-center gap-2 font-ui text-sm text-charcoal">
                <input
                  type="checkbox"
                  checked={setAsHero}
                  onChange={(e) => setSetAsHero(e.target.checked)}
                  className="rounded border-gray-300"
                  style={{ accentColor: "#D97706" }}
                />
                ☆ Set as hero image for this service
              </label>
            </>
          )}
          <button
            type="submit"
            disabled={!canUpload}
            title={!canUpload && !isUploading ? (quickUpload ? "Add at least one file first" : "Select a service, location, and at least one file first") : undefined}
            className="w-full rounded-xl bg-red py-3 font-ui text-base font-semibold text-white transition-colors hover:bg-red-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading
              ? "Uploading..."
              : `Upload ${files.length > 0 ? files.length + " " : ""}File${files.length !== 1 ? "s" : ""}`}
          </button>
        </div>

      </form>

      {/* Per-file progress */}
      {statuses.length > 0 && (
        <div className="mt-5 space-y-2.5">
          {statuses.map((status) => (
            <div key={status.name} className="rounded-lg border border-gray-warm bg-cream/50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1 truncate font-ui text-sm font-semibold text-charcoal">{status.name}</span>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {status.analysis && (
                    <span className={`font-ui text-xs ${
                      status.analysis === "ready" ? "text-navy"
                        : status.analysis === "failed" ? "text-amber-600"
                        : "text-gray-mid"
                    }`}>
                      {status.analysis === "analyzing"
                        ? "✦ Analyzing…"
                        : status.analysis === "ready"
                        ? "✦ Suggestions ready"
                        : "✦ Analysis failed"}
                    </span>
                  )}
                  <span className={`font-ui text-xs ${
                    status.state === "success" ? "text-emerald-600" : status.state === "error" ? "text-red" : "text-gray-mid"
                  }`}>
                    {status.state === "success" ? "✓ Uploaded" : status.state === "error" ? "✕ Failed" : status.state === "uploading" ? `${status.progress}%` : status.state}
                  </span>
                </div>
              </div>
              {(status.state === "uploading" || status.state === "saving") && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-warm">
                  <div className="h-full rounded-full bg-red transition-all duration-300" style={{ width: `${status.progress}%` }} />
                </div>
              )}
              {status.state === "error" && status.message && (
                <p className="mt-1 font-ui text-xs text-red">{status.message}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Completed batch actions */}
      <div ref={batchSectionRef}>
        {lastCompletedBatch && quickUpload && (
          <div className="mt-5 rounded-xl border-2 border-navy/30 bg-navy/5 p-4">
            <p className="font-ui text-xs uppercase tracking-[0.18em] text-navy">Batch Uploaded</p>
            <h3 className="mt-2 text-lg text-charcoal">AI is tagging your photos</h3>
            <p className="mt-2 text-sm text-gray-mid">
              {lastCompletedBatch.assetIds.length} photo{lastCompletedBatch.assetIds.length === 1 ? "" : "s"} uploaded and queued.
              Review the AI suggestions and publish when ready.
            </p>
            <div className="mt-4">
              <Link
                href="/admin/review"
                className="font-ui inline-flex items-center gap-2 rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white"
              >
                Review {lastCompletedBatch.assetIds.length} photo{lastCompletedBatch.assetIds.length === 1 ? "" : "s"} now →
              </Link>
            </div>
          </div>
        )}
        {lastCompletedBatch && !quickUpload && (
          <div className="mt-5 rounded-xl border border-navy/20 bg-navy/5 p-4">
            <p className="font-ui text-xs uppercase tracking-[0.18em] text-navy">Batch Uploaded</p>
            <h3 className="mt-2 text-lg text-charcoal">Finish this project now</h3>
            <p className="mt-2 text-sm text-gray-mid">
              {lastCompletedBatch.assetIds.length} file{lastCompletedBatch.assetIds.length === 1 ? "" : "s"} saved.
              Create a project, add to an existing one, or leave as standalone.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/admin/upload-batches?batch=${lastCompletedBatch.uploadBatchId}`}
                className="font-ui rounded-sm bg-red px-4 py-2 text-sm font-semibold text-white"
              >
                Create Project from This Batch
              </Link>
              <Link
                href={`/admin/upload-batches?batch=${lastCompletedBatch.uploadBatchId}&mode=link`}
                className="font-ui rounded-sm border border-gray-warm px-4 py-2 text-sm text-charcoal"
              >
                Add to Existing Project
              </Link>
              <PostToGBPButton
                caption={generateGBPCaption({
                  primaryService: primaryServiceLabel || undefined,
                  primaryLocation: resolvedLocation || undefined,
                  primaryRoom: primaryRoom || undefined,
                  primaryFeature: primaryFeature || undefined,
                  secondaryServices: secondaryServices,
                  materials: allMaterials,
                  serviceMetadata: serviceMetadata,
                })}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
