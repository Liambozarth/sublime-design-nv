import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LocalBusinessSchema from "@/components/seo/LocalBusinessSchema";
import BreadcrumbTrail from "@/components/seo/BreadcrumbTrail";
import { db } from "@/lib/db";
import { buildFacetCanonical, getSiteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Props = {
  params: { brand: string; colorSlug: string };
};

function isLight(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function brandLabelFromSlug(slug: string) {
  // Special-case common brand slugs
  const overrides: Record<string, string> = {
    "sherwin-williams": "Sherwin-Williams",
    "benjamin-moore": "Benjamin Moore",
    "dunn-edwards": "Dunn-Edwards",
    ppg: "PPG",
    behr: "Behr",
    valspar: "Valspar",
    "vista-paint": "Vista Paint",
    "general-finishes": "General Finishes",
    "rubio-monocoat": "Rubio Monocoat",
    varathane: "Varathane",
    minwax: "Minwax",
    "ml-campbell": "ML Campbell",
  };
  return overrides[slug] ?? slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const brandLabel = brandLabelFromSlug(params.brand);
  const codeSearch = params.colorSlug.replace(/-/g, " ");

  const color = await db.paintColor.findFirst({
    where: {
      brand: { contains: brandLabel, mode: "insensitive" },
      OR: [
        { code: { contains: codeSearch, mode: "insensitive" } },
        { name: { contains: codeSearch, mode: "insensitive" } },
      ],
    },
    select: { name: true, code: true, hex: true },
  });

  if (!color) return { title: "Color Not Found | Sublime Design NV" };

  const siteUrl = getSiteUrl();
  return {
    title: `${color.name} ${color.code} | ${brandLabel} | Sublime Design NV`,
    description: `${color.name} (${color.code}) by ${brandLabel}. Hex: ${color.hex}. See real Las Vegas finish carpentry projects using this color — cabinets, shelves, barn doors, and more. Get a free quote.`,
    alternates: { canonical: buildFacetCanonical(`/colors/${params.brand}/${params.colorSlug}`) },
    openGraph: {
      title: `${color.name} (${color.code}) | ${brandLabel}`,
      description: `See ${color.name} used in real Las Vegas carpentry projects.`,
      type: "website",
      url: `${siteUrl}/colors/${params.brand}/${params.colorSlug}`,
    },
    keywords: [
      color.name,
      color.code,
      brandLabel,
      `${color.name} cabinets`,
      `${color.name} Las Vegas`,
      `${color.code} finish carpentry`,
      `${brandLabel} ${color.name}`,
      "Las Vegas custom woodwork",
      "finish carpentry Las Vegas",
    ].join(", "),
  };
}

export default async function ColorReferencePage({ params }: Props) {
  const brandLabel = brandLabelFromSlug(params.brand);
  const codeSearch = params.colorSlug.replace(/-/g, " ");
  const siteUrl = getSiteUrl();

  const color = await db.paintColor.findFirst({
    where: {
      brand: { contains: brandLabel, mode: "insensitive" },
      OR: [
        { code: { contains: codeSearch, mode: "insensitive" } },
        { name: { contains: codeSearch, mode: "insensitive" } },
      ],
    },
  });

  if (!color) notFound();

  // Find published photos tagged with this color via AssetPaintColor join table
  const taggedLinks = await db.assetPaintColor.findMany({
    where: { paintColorId: color.id },
    include: {
      asset: {
        select: { id: true, secureUrl: true, alt: true, primaryServiceSlug: true, location: true, published: true },
      },
    },
    take: 24,
  });
  const taggedAssets = taggedLinks
    .map((l) => l.asset)
    .filter((a) => a.published);

  // Fallback: also find photos whose materials[] string array mentions this color
  const legacyAssets = taggedAssets.length < 12
    ? await db.asset.findMany({
        where: {
          published: true,
          kind: "IMAGE",
          OR: [
            { materials: { has: color.code } },
            { materials: { has: color.name } },
          ],
          NOT: { id: { in: taggedAssets.map((a) => a.id) } },
        },
        select: { id: true, secureUrl: true, alt: true, primaryServiceSlug: true, location: true, published: true },
        orderBy: { createdAt: "desc" },
        take: 12 - taggedAssets.length,
      })
    : [];

  const assets = [...taggedAssets, ...legacyAssets].slice(0, 12);

  // Related colors from same brand (similar hue range)
  const relatedColors = await db.paintColor.findMany({
    where: {
      brand: color.brand,
      NOT: { id: color.id },
    },
    orderBy: [{ name: "asc" }],
    take: 8,
    select: { id: true, name: true, code: true, hex: true },
  });

  const textOnSwatch = isLight(color.hex) ? "#374151" : "#ffffff";

  const photoUrls = assets.map((a) => a.secureUrl).filter(Boolean) as string[];
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${color.name} ${color.code}`,
    description: `${color.name} (${color.code}) by ${color.brand}. Color hex: ${color.hex}.`,
    brand: { "@type": "Brand", name: color.brand },
    color: color.hex,
    url: `${siteUrl}/colors/${params.brand}/${params.colorSlug}`,
    ...(photoUrls.length > 0 ? { image: photoUrls.length === 1 ? photoUrls[0] : photoUrls } : {}),
    offers: {
      "@type": "Offer",
      seller: {
        "@type": "HomeAndConstructionBusiness",
        "@id": `${siteUrl}/#business`,
        name: "Sublime Design NV",
        url: siteUrl,
      },
    },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Colors", item: `${siteUrl}/colors` },
      { "@type": "ListItem", position: 3, name: color.brand, item: `${siteUrl}/colors/${params.brand}` },
      { "@type": "ListItem", position: 4, name: `${color.name} ${color.code}`, item: `${siteUrl}/colors/${params.brand}/${params.colorSlug}` },
    ],
  };

  const ctaHref = `/quote?color=${encodeURIComponent(color.code)}&colorName=${encodeURIComponent(color.name)}&brand=${encodeURIComponent(color.brand)}`;

  const colorSlugFor = (c: { brand: string; code: string }) =>
    `${c.brand.toLowerCase().replace(/[\s/]+/g, "-")}/${c.code.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <LocalBusinessSchema />

      <main className="bg-white pb-24 pt-24">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <BreadcrumbTrail
            crumbs={[
              { label: "Home", href: "/" },
              { label: "Colors", href: "/colors" },
              { label: color.brand, href: `/colors/${params.brand}` },
              { label: color.name, href: `/colors/${params.brand}/${params.colorSlug}` },
            ]}
          />

          {/* Color hero */}
          <div className="mt-6 flex flex-col gap-8 sm:flex-row sm:items-start">
            <div
              className="h-32 w-32 flex-shrink-0 rounded-2xl border border-gray-200 shadow-sm"
              style={{ backgroundColor: color.hex }}
            />
            <div>
              <p className="font-ui text-sm font-semibold uppercase tracking-[0.18em] text-red">
                {color.brand}
              </p>
              <h1 className="mt-2 text-4xl text-charcoal md:text-5xl">{color.name}</h1>
              <p className="mt-2 font-mono text-2xl text-gray-mid">{color.code}</p>
              <div className="mt-3 flex items-center gap-3">
                <span
                  className="rounded px-2.5 py-1 font-mono text-sm"
                  style={{ backgroundColor: color.hex, color: textOnSwatch, border: "1px solid rgba(0,0,0,0.08)" }}
                >
                  {color.hex}
                </span>
                <span className="font-mono text-sm text-gray-mid">
                  rgb({color.r}, {color.g}, {color.b})
                </span>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={ctaHref}
                  className="font-ui inline-flex rounded-sm bg-red px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Get this color in your home →
                </Link>
              </div>
            </div>
          </div>

          {/* Color specs */}
          <div className="mt-10 rounded-xl border border-gray-200 bg-cream p-6">
            <h2 className="font-ui text-xs font-semibold uppercase tracking-[0.16em] text-gray-mid">
              Color Specs
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Brand", value: color.brand },
                { label: "Code", value: color.code },
                { label: "Hex", value: color.hex },
                { label: "RGB", value: `${color.r}, ${color.g}, ${color.b}` },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="font-ui text-xs font-semibold uppercase tracking-widest text-gray-mid">
                    {label}
                  </p>
                  <p className="mt-1 font-mono text-sm text-charcoal">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Projects using this color */}
          <section className="mt-12">
            <p className="font-ui text-xs font-semibold uppercase tracking-[0.18em] text-red">
              Real Work in Las Vegas
            </p>
            <h2 className="mt-2 text-2xl text-charcoal">
              Projects with a Color Match to {color.name}
            </h2>
            <p className="mt-1 max-w-2xl font-ui text-sm text-gray-mid">
              Photos whose colors are a close match to {color.name} — a color reference, not a
              statement that this exact product was used.
            </p>

            {assets.length > 0 ? (
              <div className="mt-6 columns-2 gap-3 space-y-3 md:columns-3">
                {assets.map((asset) => (
                  <div key={asset.id} className="break-inside-avoid overflow-hidden rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.secureUrl}
                      alt={asset.alt ?? `Custom woodwork in Las Vegas — color similar to ${color.name}`}
                      className="w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-gray-200 py-12 text-center">
                <div
                  className="mx-auto mb-4 h-16 w-16 rounded-xl border border-gray-200"
                  style={{ backgroundColor: color.hex }}
                />
                <p className="font-ui text-sm text-gray-mid">
                  No color-matched portfolio photos for {color.name} yet.
                </p>
                <p className="mt-1 font-ui text-xs text-gray-300">
                  We&apos;re always adding new projects — check back soon.
                </p>
                <Link
                  href={ctaHref}
                  className="mt-4 inline-block font-ui text-sm font-semibold underline"
                  style={{ color: "#CC2027" }}
                >
                  Be the first — get a quote using {color.name} →
                </Link>
              </div>
            )}
          </section>

          {/* Cross-links to service pages */}
          <section className="mt-12">
            <h2 className="text-xl font-semibold text-charcoal">
              Explore Custom Project Types
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { label: "Custom Cabinetry", slug: "custom-cabinetry" },
                { label: "Floating Shelves", slug: "floating-shelves" },
                { label: "Built-Ins", slug: "built-ins" },
                { label: "Pantry Pullouts", slug: "pantry-pullouts" },
                { label: "Closet Systems", slug: "closet-systems" },
                { label: "Mantels", slug: "mantels" },
              ].map(({ label, slug }) => (
                <Link
                  key={slug}
                  href={`/services/${slug}`}
                  className="rounded-full border border-gray-200 px-3 py-1.5 font-ui text-sm text-charcoal transition-colors hover:border-gray-400"
                >
                  {label} →
                </Link>
              ))}
            </div>
          </section>

          {/* Related colors */}
          {relatedColors.length > 0 && (
            <section className="mt-16">
              <h2 className="text-xl font-semibold text-charcoal">
                More {color.brand} Colors
              </h2>
              <div className="mt-4 flex flex-wrap gap-3">
                {relatedColors.map((c) => (
                  <Link
                    key={c.id}
                    href={`/colors/${colorSlugFor({ brand: color.brand, code: c.code }).split("/")[0]}/${colorSlugFor({ brand: color.brand, code: c.code }).split("/")[1]}`}
                    className="flex items-center gap-2 rounded-full border border-gray-200 py-1.5 pl-2 pr-3 font-ui text-sm text-charcoal transition-colors hover:border-gray-400"
                  >
                    <span
                      className="h-4 w-4 flex-shrink-0 rounded-full border border-gray-200"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span className="font-bold">{c.code}</span>
                    <span className="text-gray-mid">{c.name}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
