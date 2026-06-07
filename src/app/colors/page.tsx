"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface PaintColor {
  id: string;
  brand: string;
  code: string;
  name: string;
  hex: string;
}

const PAINT_BRANDS = [
  "All Brands",
  "Sherwin-Williams",
  "Benjamin Moore",
  "Dunn-Edwards",
  "PPG",
  "Behr",
  "Valspar",
  "Vista Paint",
];

function colorHref(color: PaintColor) {
  const brandSlug = color.brand.toLowerCase().replace(/[\s/]+/g, "-");
  const codeSlug = color.code.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `/colors/${brandSlug}/${codeSlug}`;
}

export default function ColorsPage() {
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("All Brands");
  const [results, setResults] = useState<PaintColor[]>([]);
  const [loading, setLoading] = useState(false);
  const [popular, setPopular] = useState<PaintColor[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    fetch("/api/paint-colors?q=white&brand=Sherwin-Williams&limit=24")
      .then((r) => r.json())
      .then(setPopular)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const brandParam =
          brand !== "All Brands" ? `&brand=${encodeURIComponent(brand)}` : "";
        const res = await fetch(
          `/api/paint-colors?q=${encodeURIComponent(query)}${brandParam}&limit=40`,
        );
        setResults(await res.json());
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, brand]);

  const displayColors = query.length >= 2 ? results : popular;

  return (
    <main className="bg-white pb-24 pt-24">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <p className="font-ui text-sm font-semibold uppercase tracking-[0.18em] text-red">
          Color Reference
        </p>
        <h1 className="mt-3 text-4xl text-charcoal md:text-5xl">
          Paint Color Explorer
        </h1>
        <p className="mt-4 max-w-2xl text-base text-gray-mid">
          Browse 5,800+ colors from Sherwin-Williams, Benjamin Moore, and more. See real Las Vegas
          projects with a close color match to each color and get a free quote.
        </p>

        {/* Search + brand filter */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or code (e.g. Alabaster, SW 7006, OC-17)..."
            className="flex-1 rounded-sm border border-gray-200 bg-white px-4 py-3 font-ui text-sm text-charcoal outline-none transition focus:border-navy"
          />
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="rounded-sm border border-gray-200 bg-white px-4 py-3 font-ui text-sm text-charcoal outline-none transition focus:border-navy sm:w-56"
          >
            {PAINT_BRANDS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </div>

        {query.length >= 2 && (
          <p className="mt-3 font-ui text-xs text-gray-mid">
            {loading ? "Searching…" : `${results.length} color${results.length === 1 ? "" : "s"} found`}
          </p>
        )}

        {/* Color grid */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {displayColors.map((color) => (
            <Link
              key={color.id}
              href={colorHref(color)}
              className="group overflow-hidden rounded-xl border border-gray-100 transition-shadow hover:shadow-md"
            >
              <div className="h-24 w-full" style={{ backgroundColor: color.hex }} />
              <div className="bg-white p-2">
                <p className="truncate font-ui text-xs font-bold text-charcoal">{color.code}</p>
                <p className="truncate font-ui text-xs text-gray-mid">{color.name}</p>
                <p className="truncate font-ui text-[10px] text-gray-300">{color.brand}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Empty state */}
        {query.length >= 2 && !loading && results.length === 0 && (
          <div className="mt-10 rounded-xl border border-gray-200 bg-cream px-8 py-16 text-center">
            <p className="font-ui text-base text-gray-mid">
              No colors found for &ldquo;{query}&rdquo;
            </p>
          </div>
        )}

        {/* Browse by brand */}
        {query.length < 2 && (
          <section className="mt-16">
            <h2 className="text-2xl text-charcoal">Browse by Brand</h2>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {PAINT_BRANDS.filter((b) => b !== "All Brands").map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => {
                    setBrand(b);
                    setQuery("white");
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-left font-ui text-sm text-charcoal transition-colors hover:border-red hover:text-red"
                >
                  {b}
                  <span className="ml-1 text-xs text-gray-mid">→</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="mt-16 rounded-xl border border-gray-200 bg-cream px-8 py-10 text-center">
          <p className="font-ui text-xs font-semibold uppercase tracking-[0.18em] text-red">
            Ready to Build?
          </p>
          <h2 className="mt-3 text-2xl text-charcoal">Found your color?</h2>
          <p className="mt-2 font-ui text-sm text-gray-mid">
            Tell us the color code and we&apos;ll match it exactly on your custom cabinets,
            shelves, or built-ins.
          </p>
          <Link
            href="/quote"
            className="mt-5 inline-flex rounded-sm bg-red px-6 py-3 font-ui text-sm font-semibold text-white transition hover:opacity-90"
          >
            Get a Free Quote
          </Link>
        </div>
      </div>
    </main>
  );
}
