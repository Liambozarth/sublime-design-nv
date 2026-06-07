"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MapCluster } from "@/components/admin/PhotoMapInner";

type GeoPoint = {
  id: string;
  thumbnailUrl: string | null;
  title: string | null;
  areaSlug: string | null;
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  published: boolean;
  exifTakenAt: string | null;
  lat: number;
  lng: number;
};

const PhotoMapInner = dynamic(() => import("@/components/admin/PhotoMapInner"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center font-ui text-sm text-gray-mid">Loading map…</div>,
});

const round3 = (n: number) => Math.round(n * 1000) / 1000; // ~111 m grid

export default function PhotoMap() {
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/assets/geo");
        const data = (await res.json()) as { points?: GeoPoint[] };
        if (active) setPoints(data.points ?? []);
      } catch {
        if (active) setError("Failed to load map data.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Cluster points on a ~100 m rounding grid.
  const { clusters, byKey } = useMemo(() => {
    const groups = new Map<string, GeoPoint[]>();
    for (const p of points) {
      const key = `${round3(p.lat)},${round3(p.lng)}`;
      const arr = groups.get(key);
      if (arr) arr.push(p);
      else groups.set(key, [p]);
    }
    const clusters: MapCluster[] = Array.from(groups.entries()).map(([key, arr]) => ({
      key,
      lat: arr.reduce((s, p) => s + p.lat, 0) / arr.length,
      lng: arr.reduce((s, p) => s + p.lng, 0) / arr.length,
      count: arr.length,
      hasPending: arr.some((p) => p.reviewStatus === "PENDING"),
    }));
    return { clusters, byKey: groups };
  }, [points]);

  const selected = selectedKey ? byKey.get(selectedKey) ?? [] : [];

  if (loading) return <p className="mt-10 font-ui text-sm text-gray-mid">Loading photo map…</p>;
  if (error) return <p className="mt-10 font-ui text-sm text-red">{error}</p>;

  if (points.length === 0) {
    return (
      <div className="mt-10 rounded-xl border border-gray-200 bg-white p-10 text-center">
        <p className="text-2xl text-charcoal">No geotagged photos yet</p>
        <p className="mt-2 font-ui text-sm text-gray-mid">
          Photos uploaded with GPS EXIF will appear here on the map.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="mb-2 font-ui text-xs text-gray-mid">
        {points.length} geotagged photo{points.length === 1 ? "" : "s"} · {clusters.length} location
        {clusters.length === 1 ? "" : "s"} · <span className="text-red">red = has pending</span>,{" "}
        <span className="text-navy">navy = all reviewed</span>
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-[60vh] overflow-hidden rounded-xl border border-gray-200 lg:col-span-2">
          <PhotoMapInner clusters={clusters} onSelect={setSelectedKey} />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          {selected.length === 0 ? (
            <p className="font-ui text-sm text-gray-mid">Tap a pin to see its photos.</p>
          ) : (
            <>
              <p className="font-ui text-sm font-semibold text-charcoal">
                {selected.length} photo{selected.length === 1 ? "" : "s"} at this spot
                {selected[0]?.areaSlug ? ` · ${selected[0].areaSlug}` : ""}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {selected.map((p) => (
                  <Link
                    key={p.id}
                    href={p.reviewStatus === "PENDING" ? "/admin/review" : "/admin/photos"}
                    className="group block overflow-hidden rounded-lg border border-gray-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.thumbnailUrl ?? ""} alt={p.title ?? ""} className="h-24 w-full object-cover" />
                    <div className="p-1.5">
                      <p className="truncate font-ui text-[11px] text-charcoal">{p.title ?? "Untitled"}</p>
                      <span
                        className={`font-ui text-[10px] font-semibold ${
                          p.reviewStatus === "PENDING" ? "text-red" : p.published ? "text-emerald-600" : "text-gray-400"
                        }`}
                      >
                        {p.reviewStatus === "PENDING" ? "Review →" : p.published ? "Published" : p.reviewStatus}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
