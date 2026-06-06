import { nearestAreaSlug, haversineDistanceKm } from "@/lib/geo";

const cases: { name: string; lat: number; lng: number; expect: string | null }[] = [
  { name: "Southern Highlands center", lat: 35.9734, lng: -115.1898, expect: "southern-highlands" },
  { name: "Boulder City (~35.97,-114.83)", lat: 35.97, lng: -114.83, expect: null },
  { name: "Anthem", lat: 35.9727, lng: -115.0845, expect: "anthem" },
];

let failures = 0;
for (const c of cases) {
  const got = nearestAreaSlug(c.lat, c.lng);
  const pass = got === c.expect;
  if (!pass) failures++;
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${c.name}: got=${got ?? "null"} expected=${c.expect ?? "null"}`,
  );
}

// Sanity: Boulder City distance to nearest mapped area should exceed 10km
const bcToLakeLV = haversineDistanceKm(35.97, -114.83, 36.1034, -114.9283);
console.log(`Boulder City -> Lake Las Vegas distance: ${bcToLakeLV.toFixed(1)} km`);

if (failures > 0) {
  console.error(`\n${failures} case(s) failed.`);
  process.exit(1);
}
console.log("\nAll geo cases passed.");
