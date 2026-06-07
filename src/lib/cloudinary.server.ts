import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { findService } from "@/content/services";
import { CITIES, MATERIALS, ROOMS } from "@/lib/facets.config";
import { slugify, titleCaseFromSlug } from "@/lib/seo";

function required(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

let cloudinaryConfigured = false;

function ensureCloudinaryConfigured() {
  if (cloudinaryConfigured) return;

  cloudinary.config({
    cloud_name: required("CLOUDINARY_CLOUD_NAME", process.env.CLOUDINARY_CLOUD_NAME),
    api_key: required("CLOUDINARY_API_KEY", process.env.CLOUDINARY_API_KEY),
    api_secret: required("CLOUDINARY_API_SECRET", process.env.CLOUDINARY_API_SECRET),
  });

  cloudinaryConfigured = true;
}

export const PROJECTS_ROOT_FOLDER = "Sublime/Projects";

export type ProjectContext = {
  project_name?: string;
  project_slug?: string;
  service?: string;
  city?: string;
  state?: string;
  material?: string;
  finish?: string;
  room?: string;
  style?: string;
  year?: string;
  featured?: string;
  caption?: string;
  alt?: string;
  gps_lat?: string;
  gps_lng?: string;
};

export type CloudinaryAsset = {
  public_id: string;
  secure_url: string;
  width?: number;
  height?: number;
  format?: string;
  created_at?: string;
  context?: ProjectContext;
  tags?: string[];
};

export type ProjectGallery = {
  slug: string;
  name: string;
  caption?: string;
  featured: boolean;
  service?: string;
  city?: string;
  state?: string;
  material?: string;
  finish?: string;
  room?: string;
  style?: string;
  year?: string;
  images: CloudinaryAsset[];
};

export type ProjectSlugDebugInfo = {
  slug: string;
  folder: string;
  expression: string;
  assetsCount: number;
  matchedCount: number;
  firstPublicId: string | null;
};

export type ProjectIndexItem = {
  slug: string;
  name: string;
  citySlug?: string;
  cityLabel?: string;
  state?: string;
  serviceSlug?: string;
  serviceLabel?: string;
  materialSlug?: string;
  materialLabel?: string;
  roomSlug?: string;
  roomLabel?: string;
  style?: string;
  year?: string;
  featured?: boolean;
  heroPublicId?: string;
  heroAlt?: string;
  updatedAt?: string;
};

type ProjectFilterValue = string | undefined;
export type ProjectFilterParams = {
  service?: ProjectFilterValue;
  city?: ProjectFilterValue;
  material?: ProjectFilterValue;
  featured?: "true" | undefined;
  year?: ProjectFilterValue;
  page?: number;
  pageSize?: number;
};

type FacetItem = {
  value: string;
  count: number;
};

type ProjectsWithFacetsResult = {
  projects: ProjectGallery[];
  facets: {
    services: FacetItem[];
    cities: FacetItem[];
    materials: FacetItem[];
    years: FacetItem[];
  };
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type CloudinarySearchResource = {
  public_id: string;
  secure_url: string;
  width?: number;
  height?: number;
  format?: string;
  created_at?: string;
  tags?: string[];
  context?: {
    custom?: ProjectContext;
  };
};

function getSlugFromPublicId(publicId: string) {
  const prefix = `${PROJECTS_ROOT_FOLDER}/`;
  if (!publicId.startsWith(prefix)) return null;
  const rest = publicId.slice(prefix.length);
  const [slug] = rest.split("/");
  return slug || null;
}

function mapResource(resource: CloudinarySearchResource): CloudinaryAsset {
  return {
    public_id: resource.public_id,
    secure_url: resource.secure_url,
    width: resource.width,
    height: resource.height,
    format: resource.format,
    created_at: resource.created_at,
    context: resource.context?.custom,
    tags: resource.tags ?? [],
  };
}

function normalizeProjectName(slug: string, image: CloudinaryAsset) {
  if (image.context?.project_name?.trim()) {
    return image.context.project_name.trim();
  }

  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isFeatured(value: string | undefined) {
  if (!value) return false;
  return value.toLowerCase() === "true";
}

async function searchByExpression(expression: string, maxResults = 500) {
  ensureCloudinaryConfigured();

  try {
    const result = await cloudinary.search
      .expression(expression)
      .sort_by("created_at", "desc")
      .max_results(maxResults)
      .execute();

    return (result?.resources ?? []) as CloudinarySearchResource[];
  } catch (error) {
    const details = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Cloudinary query failed for expression "${expression}": ${details}`);
  }
}

export async function listAssetsByFolder(
  folder: string,
  maxResults = 60,
): Promise<CloudinaryAsset[]> {
  const resources = await searchByExpression(`folder:${folder}`, maxResults);
  return resources.map(mapResource);
}

export async function listAssetsByPublicIdPrefix(
  folderPrefix: string,
  maxResults = 200,
): Promise<CloudinaryAsset[]> {
  const resources = await searchByExpression(`public_id:${folderPrefix}/*`, maxResults);
  return resources.map(mapResource);
}

export async function listAssetsByFolders(folders: string[], maxPerFolder = 60) {
  const entries = await Promise.all(
    folders.map(async (folder) => {
      const assets = await listAssetsByFolder(folder, maxPerFolder);
      return [folder, assets] as const;
    }),
  );

  return Object.fromEntries(entries);
}

export async function listProjectAssets(maxResults = 500): Promise<CloudinaryAsset[]> {
  return listAssetsByPublicIdPrefix(PROJECTS_ROOT_FOLDER, maxResults);
}

export async function listProjectSlugs(
  prefix = PROJECTS_ROOT_FOLDER,
  maxResults = 200,
): Promise<string[]> {
  const resources = await searchByExpression(`public_id:${prefix}/*`, maxResults);
  const seen = new Set<string>();
  const slugs: string[] = [];

  for (const resource of resources) {
    const slug = getSlugFromPublicId(resource.public_id);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    slugs.push(slug);
  }

  return slugs;
}

export async function listAssetsByProjectSlug(slug: string, maxResults = 200) {
  const safeMaxResults = Math.max(1, Math.min(maxResults, 500));
  const folder = `${PROJECTS_ROOT_FOLDER}/${slug}`;
  const resources = await searchByExpression(`public_id:${folder}/*`, safeMaxResults);
  return resources.map(mapResource);
}

function matchesProjectSlug(asset: CloudinaryAsset, slug: string) {
  const contextSlug = asset.context?.project_slug?.trim();
  if (contextSlug) {
    return contextSlug === slug;
  }
  return getSlugFromPublicId(asset.public_id) === slug;
}

function toCanonicalSlug(
  value: string | undefined,
  options: ReadonlyArray<{ slug: string; label: string }>,
) {
  if (!value) return undefined;
  const normalized = slugify(value);
  return options.some((option) => option.slug === normalized) ? normalized : undefined;
}

function toCanonicalLabel(
  slug: string | undefined,
  options: ReadonlyArray<{ slug: string; label: string }>,
) {
  if (!slug) return undefined;
  return options.find((option) => option.slug === slug)?.label;
}

function getFacetValueFromTags(tags: string[] | undefined, prefix: string) {
  if (!tags?.length) return undefined;
  const match = tags.find((tag) => tag.startsWith(`${prefix}:`));
  return match ? match.slice(prefix.length + 1).trim() : undefined;
}

export async function getProjectSlugDebugInfo(
  slug: string,
  maxResults = 200,
): Promise<ProjectSlugDebugInfo> {
  const folder = `${PROJECTS_ROOT_FOLDER}/${slug}`;
  const expression = `public_id:${folder}/*`;
  const assets = await listAssetsByProjectSlug(slug, maxResults);
  const matched = assets.filter((asset) => matchesProjectSlug(asset, slug));

  return {
    slug,
    folder,
    expression,
    assetsCount: assets.length,
    matchedCount: matched.length,
    firstPublicId: assets[0]?.public_id ?? null,
  };
}

export async function listProjects(maxResults = 500): Promise<ProjectGallery[]> {
  const assets = await listProjectAssets(maxResults);
  const grouped = new Map<string, CloudinaryAsset[]>();

  for (const asset of assets) {
    const slug = asset.context?.project_slug || getSlugFromPublicId(asset.public_id);
    if (!slug) continue;

    const current = grouped.get(slug) ?? [];
    current.push(asset);
    grouped.set(slug, current);
  }

  const projects = Array.from(grouped.entries()).map(([slug, images]) => {
    images.sort((a, b) => {
      const aTime = a.created_at ? Date.parse(a.created_at) : 0;
      const bTime = b.created_at ? Date.parse(b.created_at) : 0;
      return bTime - aTime;
    });

    const first = images[0];
    return {
      slug,
      name: normalizeProjectName(slug, first),
      caption: first.context?.caption,
      featured: isFeatured(first.context?.featured),
      service: first.context?.service,
      city: first.context?.city,
      state: first.context?.state,
      material: first.context?.material,
      finish: first.context?.finish,
      room: first.context?.room,
      style: first.context?.style,
      year: first.context?.year,
      images,
    } satisfies ProjectGallery;
  });

  projects.sort((a, b) => {
    if (a.featured !== b.featured) {
      return a.featured ? -1 : 1;
    }

    const aTime = a.images[0]?.created_at ? Date.parse(a.images[0].created_at as string) : 0;
    const bTime = b.images[0]?.created_at ? Date.parse(b.images[0].created_at as string) : 0;
    return bTime - aTime;
  });

  return projects;
}

export async function listProjectsIndex(maxProjects = 200): Promise<ProjectIndexItem[]> {
  const slugs = await listProjectSlugs(PROJECTS_ROOT_FOLDER, Math.min(maxProjects * 3, 500));
  const selectedSlugs = slugs.slice(0, maxProjects);

  const entries = await Promise.all(
    selectedSlugs.map(async (slug) => {
      const assets = await listAssetsByProjectSlug(slug, 120);
      const matching = assets.filter((asset) => matchesProjectSlug(asset, slug));
      if (!matching.length) return null;

      matching.sort((a, b) => {
        const aTime = a.created_at ? Date.parse(a.created_at) : 0;
        const bTime = b.created_at ? Date.parse(b.created_at) : 0;
        return bTime - aTime;
      });

      const first = matching[0];
      const serviceTag = getFacetValueFromTags(first.tags, "service");
      const cityTag = getFacetValueFromTags(first.tags, "city");
      const materialTag = getFacetValueFromTags(first.tags, "material");
      const roomTag = getFacetValueFromTags(first.tags, "room");

      const serviceSlug =
        serviceTag ||
        (first.context?.service ? slugify(first.context.service) : undefined);
      const citySlug = cityTag || toCanonicalSlug(first.context?.city, CITIES);
      const materialSlug = materialTag || toCanonicalSlug(first.context?.material, MATERIALS);
      const roomSlug = roomTag || toCanonicalSlug(first.context?.room, ROOMS);

      const item: ProjectIndexItem = {
        slug,
        name: normalizeProjectName(slug, first),
        citySlug,
        cityLabel: citySlug ? toCanonicalLabel(citySlug, CITIES) : first.context?.city,
        state: first.context?.state || "NV",
        serviceSlug,
        serviceLabel: serviceSlug
          ? findService(serviceSlug)?.shortTitle ?? titleCaseFromSlug(serviceSlug)
          : first.context?.service,
        materialSlug,
        materialLabel: materialSlug
          ? toCanonicalLabel(materialSlug, MATERIALS)
          : first.context?.material,
        roomSlug,
        roomLabel: roomSlug ? toCanonicalLabel(roomSlug, ROOMS) : first.context?.room,
        style: first.context?.style,
        year: first.context?.year,
        featured: isFeatured(first.context?.featured),
        heroPublicId: first.public_id,
        heroAlt: first.context?.alt,
        updatedAt: first.created_at,
      };

      return item;
    }),
  );

  return entries.filter((entry): entry is ProjectIndexItem => Boolean(entry));
}

export async function getProjectBySlug(slug: string, maxResults = 200) {
  const assetsInFolder = await listAssetsByProjectSlug(slug, maxResults);
  const assets = assetsInFolder.filter((asset) => matchesProjectSlug(asset, slug));
  if (!assets.length) return null;

  assets.sort((a, b) => {
    const aTime = a.created_at ? Date.parse(a.created_at) : 0;
    const bTime = b.created_at ? Date.parse(b.created_at) : 0;
    return bTime - aTime;
  });

  const first = assets[0];
  const project: ProjectGallery = {
    slug,
    name: normalizeProjectName(slug, first),
    caption: first.context?.caption,
    featured: isFeatured(first.context?.featured),
    service: first.context?.service,
    city: first.context?.city,
    state: first.context?.state,
    material: first.context?.material,
    finish: first.context?.finish,
    room: first.context?.room,
    style: first.context?.style,
    year: first.context?.year,
    images: assets,
  };

  return project;
}

function toFacetItems(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

export async function listProjectsWithFacets(
  params: ProjectFilterParams = {},
): Promise<ProjectsWithFacetsResult> {
  const pageSize = Math.max(1, Math.min(params.pageSize ?? 24, 100));
  const page = Math.max(1, params.page ?? 1);
  const projects = await listProjects(1000);

  const facets = {
    services: toFacetItems(projects.map((project) => project.service ?? "")),
    cities: toFacetItems(projects.map((project) => project.city ?? "")),
    materials: toFacetItems(projects.map((project) => project.material ?? "")),
    years: toFacetItems(projects.map((project) => project.year ?? "")),
  };

  const filtered = projects.filter((project) => {
    if (params.service && project.service !== params.service) return false;
    if (params.city && project.city !== params.city) return false;
    if (params.material && project.material !== params.material) return false;
    if (params.year && project.year !== params.year) return false;
    if (params.featured === "true" && !project.featured) return false;
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    projects: filtered.slice(start, start + pageSize),
    facets,
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

function normalizeContextForCloudinary(context: Record<string, string>) {
  const pairs = Object.entries(context)
    .map(([key, value]) => [key.trim(), value.trim()] as const)
    .filter(([key, value]) => key.length > 0 && value.length > 0)
    .map(([key, value]) => `${key}=${value.replace(/[|=]/g, " ")}`);

  return pairs.join("|");
}

export async function updateAssetContext(publicId: string, context: Record<string, string>) {
  ensureCloudinaryConfigured();

  const contextString = normalizeContextForCloudinary(context);
  if (!contextString) return;

  try {
    await cloudinary.api.update(publicId, {
      resource_type: "image",
      type: "upload",
      context: contextString,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Failed to update context for "${publicId}": ${details}`);
  }
}

/**
 * List assets tagged with `service:<slug>`.
 * Searches across all folders, so it covers both Sublime/Projects and Sublime/Portfolio.
 */
export async function listAssetsByServiceTag(
  serviceSlug: string,
  maxResults = 50,
): Promise<CloudinaryAsset[]> {
  const resources = await searchByExpression(
    `tags=service:${serviceSlug}`,
    maxResults,
  );
  return resources.map(mapResource);
}

export async function addAssetTags(publicId: string, tags: string[]) {
  ensureCloudinaryConfigured();

  const cleanTags = Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => tag.replace(/,/g, "-")),
    ),
  );

  if (!cleanTags.length) return;

  try {
    const resource = (await cloudinary.api.resource(publicId, {
      resource_type: "image",
      type: "upload",
      tags: true,
    })) as { tags?: string[] };

    const mergedTags = Array.from(new Set([...(resource.tags ?? []), ...cleanTags]));

    await cloudinary.api.update(publicId, {
      resource_type: "image",
      type: "upload",
      tags: mergedTags,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Failed to add tags for "${publicId}": ${details}`);
  }
}

export async function removeAssetTags(publicId: string, tagsToRemove: string[]) {
  ensureCloudinaryConfigured();

  if (!tagsToRemove.length) return;

  const normalizedRemove = tagsToRemove.map((t) => t.toLowerCase().trim());

  try {
    const resource = (await cloudinary.api.resource(publicId, {
      resource_type: "image",
      type: "upload",
      tags: true,
    })) as { tags?: string[] };

    const filteredTags = (resource.tags ?? []).filter(
      (tag) => !normalizedRemove.includes(tag.toLowerCase().trim()),
    );

    await cloudinary.api.update(publicId, {
      resource_type: "image",
      type: "upload",
      tags: filteredTags,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Failed to remove tags for "${publicId}": ${details}`);
  }
}

export async function getAssetByPublicId(publicId: string): Promise<CloudinaryAsset | null> {
  ensureCloudinaryConfigured();

  try {
    const resource = (await cloudinary.api.resource(publicId, {
      resource_type: "image",
      type: "upload",
      context: true,
      tags: true,
    })) as CloudinarySearchResource;

    return mapResource(resource);
  } catch {
    return null;
  }
}

// Service slug → Cloudinary folder (mirrors src/lib/cloudinaryUpload.ts buildPublicId).
const SERVICE_FOLDER_MAP: Record<string, string> = {
  "barn-doors": "BarnDoors",
  "media-walls": "MediaWalls",
  "faux-beams": "FauxBeams",
  "floating-shelves": "FloatingShelves",
  mantels: "Mantels",
  cabinets: "Cabinets",
  "custom-closets": "CustomClosets",
  trim: "TrimWork",
  "feature-wall": "FeatureWalls",
  "led-lighting": "LEDLighting",
};

/**
 * Rename an Inbox (quick-upload) asset to the curated folder convention used by normal
 * uploads: Sublime/<ServiceFolder>/<service>-<descriptor>-<location>-las-vegas.
 * Returns the new { publicId, secureUrl }, or null if no rename was performed.
 * On collision, retries once with a short unique suffix. Throws only on hard API errors.
 */
export async function renameAssetToCurated(opts: {
  fromPublicId: string;
  serviceSlug: string;
  descriptor: string;
  location?: string | null;
  uniqueSuffix: string;
}): Promise<{ publicId: string; secureUrl: string } | null> {
  ensureCloudinaryConfigured();

  const folder = `Sublime/${SERVICE_FOLDER_MAP[opts.serviceSlug] ?? "Gallery"}`;
  const slug = [slugify(opts.serviceSlug), slugify(opts.descriptor), slugify(opts.location ?? ""), "las-vegas"]
    .filter(Boolean)
    .join("-")
    .replace(/-+/g, "-");
  const target = `${folder}/${slug}`;

  if (!target || target === opts.fromPublicId) return null;

  async function rename(to: string) {
    return (await cloudinary.uploader.rename(opts.fromPublicId, to, {
      resource_type: "image",
      overwrite: false,
      invalidate: true,
    })) as { public_id: string; secure_url: string };
  }

  try {
    const res = await rename(target);
    return { publicId: res.public_id, secureUrl: res.secure_url };
  } catch {
    // Likely a name collision — retry once with a short unique suffix.
    try {
      const res = await rename(`${target}-${opts.uniqueSuffix.slice(0, 6)}`);
      return { publicId: res.public_id, secureUrl: res.secure_url };
    } catch (error) {
      throw new Error(
        `Cloudinary rename failed for "${opts.fromPublicId}": ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }
}
