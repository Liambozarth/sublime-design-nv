"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";

export type MapCluster = {
  key: string;
  lat: number;
  lng: number;
  count: number;
  hasPending: boolean;
};

function FitBounds({ clusters }: { clusters: MapCluster[] }) {
  const map = useMap();
  useEffect(() => {
    if (clusters.length === 0) return;
    const bounds = L.latLngBounds(clusters.map((c) => [c.lat, c.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [clusters, map]);
  return null;
}

function pinIcon(c: MapCluster) {
  const color = c.hasPending ? "#CC2027" : "#1B2A6B";
  const html = `<div style="background:${color};color:#fff;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"><span style="transform:rotate(45deg);font:700 12px sans-serif">${c.count}</span></div>`;
  return L.divIcon({ html, className: "", iconSize: [30, 30], iconAnchor: [15, 30] });
}

export default function PhotoMapInner({
  clusters,
  onSelect,
}: {
  clusters: MapCluster[];
  onSelect: (key: string) => void;
}) {
  // Fallback viewport: Las Vegas valley.
  const center: [number, number] = clusters.length
    ? [clusters[0]!.lat, clusters[0]!.lng]
    : [36.1, -115.15];

  return (
    <MapContainer center={center} zoom={10} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds clusters={clusters} />
      {clusters.map((c) => (
        <Marker
          key={c.key}
          position={[c.lat, c.lng]}
          icon={pinIcon(c)}
          eventHandlers={{ click: () => onSelect(c.key) }}
        />
      ))}
    </MapContainer>
  );
}
