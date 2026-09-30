import { ACTIVE_AREAS } from "@/content/areas";
import type { MetadataRoute } from "next";
import { listProjects, listProjectsIndex } from "@/lib/cloudinary.server";
import { ACTIVE_SERVICES } from "@/content/services";
import { PROJECT_LIST } from "@/content/projects";
import { getProjectCardPreviewAsset, getServiceCardPreviewAsset } from "@/lib/portfolio.server";
import { slugify } from "@/lib/seo";
import { CITIES, MATERIALS, ROOMS } from "@/lib/facets.config";
import { db } from "@/lib/db";

export const revalidate = 3600;

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://sublime-design-nv.vercel.app";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();
  const projects = await listProjects(1000).catch(() => []);
  const projectsIndex = await listProjectsIndex(500).catch(() => []);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now },
    { url: `${siteUrl}/areas`, lastModified: now },
    { url: `${siteUrl}/gallery`, lastModified: now },
    { url: `${siteUrl}/projects`, lastModified: now },
    { url: `${siteUrl}/services`, lastModified: now },
    { url: `${siteUrl}/quote`, lastModified: now },
    { url: `${siteUrl}/privacy`, lastModified: now },
    { url: `${siteUrl}/terms`, lastModified: now },
    { url: `${siteUrl}/colors`, lastModified: now },
    { url: `${siteUrl}/materials`, lastModified: now },
  ];

  // Canonical service routes from the content registry
  const serviceRoutes: MetadataRoute.Sitemap = await Promise.all(
    ACTIVE_SERVICES.map(async (service) => {
      const preview = await getServiceCardPreviewAsset(service.slug).catch(() => null);
      return {
        url: `${siteUrl}/services/${service.slug}`,
        lastModified: now,
        ...(preview?.secureUrl ? { images: [preview.secureUrl] } : {}),
      };
    }),
  );

  const areaRoutes: MetadataRoute.Sitemap = ACTIVE_AREAS.map((area) => ({
    url: `${siteUrl}/areas/${area.slug}`,
    lastModified: now,
  }));

  // Canonical project routes from the content registry (case-study pages)
  const canonicalProjectRoutes: MetadataRoute.Sitemap = await Promise.all(
    PROJECT_LIST.map(async (project) => {
      const preview = await getProjectCardPreviewAsset(
        project.slug,
        project.galleryServiceSlug ?? project.serviceSlug,
      ).catch(() => null);

      return {
        url: `${siteUrl}/projects/${project.slug}`,
        lastModified: now,
        ...(preview?.secureUrl ? { images: [preview.secureUrl] } : {}),
      };
    }),
  );

  // Cloudinary-backed project routes (dynamic portfolio)
  const cloudinaryProjectRoutes: MetadataRoute.Sitemap = projects
    .filter((project) => !PROJECT_LIST.some((p) => p.slug === project.slug))
    .map((project) => ({
      url: `${siteUrl}/projects/${project.slug}`,
      lastModified: project.images[0]?.created_at
        ? new Date(project.images[0].created_at)
        : now,
      ...(project.images[0]?.secure_url ? { images: [project.images[0].secure_url] } : {}),
    }));

  const projectRoutes = [...canonicalProjectRoutes, ...cloudinaryProjectRoutes];

  const locationRoutes: MetadataRoute.Sitemap = Array.from(
    new Set(
      projects
        .filter((project) => project.city && project.service)
        .map((project) => `/${slugify(project.city as string)}-${project.service as string}`),
    ),
  ).map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
  }));

  const serviceMaterialFacetRoutes: MetadataRoute.Sitemap = [];
  const serviceRoomFacetRoutes: MetadataRoute.Sitemap = [];
  const cityServiceMaterialFacetRoutes: MetadataRoute.Sitemap = [];
  const cityServiceRoomFacetRoutes: MetadataRoute.Sitemap = [];

  for (const { slug: service } of ACTIVE_SERVICES) {
    for (const material of MATERIALS) {
      const match = projectsIndex.some(
        (project) =>
          project.serviceSlug === service && project.materialSlug === material.slug,
      );
      if (match) {
        serviceMaterialFacetRoutes.push({
          url: `${siteUrl}/services/${service}/material/${material.slug}`,
          lastModified: now,
        });
      }
    }

    for (const room of ROOMS) {
      const match = projectsIndex.some(
        (project) => project.serviceSlug === service && project.roomSlug === room.slug,
      );
      if (match) {
        serviceRoomFacetRoutes.push({
          url: `${siteUrl}/services/${service}/room/${room.slug}`,
          lastModified: now,
        });
      }
    }
  }

  for (const city of CITIES) {
    for (const { slug: service } of ACTIVE_SERVICES) {
      for (const material of MATERIALS) {
        const match = projectsIndex.some(
          (project) =>
            project.citySlug === city.slug &&
            project.serviceSlug === service &&
            project.materialSlug === material.slug,
        );
        if (match) {
          cityServiceMaterialFacetRoutes.push({
            url: `${siteUrl}/${city.slug}-${service}/material/${material.slug}`,
            lastModified: now,
          });
        }
      }

      for (const room of ROOMS) {
        const match = projectsIndex.some(
          (project) =>
            project.citySlug === city.slug &&
            project.serviceSlug === service &&
            project.roomSlug === room.slug,
        );
        if (match) {
          cityServiceRoomFacetRoutes.push({
            url: `${siteUrl}/${city.slug}-${service}/room/${room.slug}`,
            lastModified: now,
          });
        }
      }
    }
  }

  // ── New programmatic SEO pages ─────────────────────────────────────────────

  // Type A: Location × Service
  const locationServiceRoutes: MetadataRoute.Sitemap = ACTIVE_SERVICES.flatMap((service) =>
    ACTIVE_AREAS.map((area) => ({
      url: `${siteUrl}/services/${service.slug}/${area.slug}`,
      lastModified: now,
    })),
  );

  // Type B: Material × Service (from DB — only combos that actually have assets)
  let materialServiceRoutes: MetadataRoute.Sitemap = [];
  try {
    const materialAssets = await db.asset.findMany({
      where: { published: true, kind: "IMAGE" },
      select: { primaryServiceSlug: true, materials: true },
    });
    const materialCombos = new Set<string>();
    for (const asset of materialAssets) {
      if (!asset.primaryServiceSlug) continue;
      for (const mat of asset.materials ?? []) {
        const matSlug = mat.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        if (matSlug) materialCombos.add(`${asset.primaryServiceSlug}|${matSlug}`);
      }
    }
    materialServiceRoutes = Array.from(materialCombos).map((combo) => {
      const [service, material] = combo.split("|");
      return { url: `${siteUrl}/gallery/${service}/${material}`, lastModified: now };
    });
  } catch { /* db unavailable at build time — skip */ }

  // Type C: Color reference pages — popular colors seeded in DB
  let colorRoutes: MetadataRoute.Sitemap = [];
  try {
    const popularColors = await db.paintColor.findMany({
      where: {
        OR: [
          { brand: "Sherwin-Williams" },
          { brand: "Benjamin Moore" },
        ],
      },
      select: { brand: true, code: true },
      take: 200,
    });
    colorRoutes = popularColors.map((c) => {
      const brandSlug = c.brand.toLowerCase().replace(/[\s/]+/g, "-");
      const colorSlug = c.code.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      return { url: `${siteUrl}/colors/${brandSlug}/${colorSlug}`, lastModified: now };
    });
  } catch { /* db unavailable at build time — skip */ }

  // Type D: Material detail pages — only materials that have published assets
  let materialDetailRoutes: MetadataRoute.Sitemap = [];
  try {
    const matAssets = await db.asset.findMany({
      where: { published: true, kind: "IMAGE" },
      select: { materials: true },
    });
    const matSlugs = new Set<string>();
    for (const asset of matAssets) {
      for (const mat of asset.materials ?? []) {
        const s = mat.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        if (s) matSlugs.add(s);
      }
    }
    materialDetailRoutes = Array.from(matSlugs).map((slug) => ({
      url: `${siteUrl}/materials/${slug}`,
      lastModified: now,
    }));
  } catch { /* db unavailable at build time — skip */ }

  return [
    ...staticRoutes,
    ...areaRoutes,
    ...serviceRoutes,
    ...projectRoutes,
    ...locationRoutes,
    ...serviceMaterialFacetRoutes,
    ...serviceRoomFacetRoutes,
    ...cityServiceMaterialFacetRoutes,
    ...cityServiceRoomFacetRoutes,
    ...locationServiceRoutes,
    ...materialServiceRoutes,
    ...colorRoutes,
    ...materialDetailRoutes,
  ];
}
