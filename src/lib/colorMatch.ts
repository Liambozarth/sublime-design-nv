// Pure color-matching engine: sRGB → CIELAB + CIEDE2000 distance, plus paint/stain
// matching against preloaded PaintColor rows. No external dependencies.

export type Lab = [number, number, number];

export type PaintColorRow = {
  id: string;
  brand: string;
  name: string;
  code: string;
  hex: string;
  r: number;
  g: number;
  b: number;
};

export type ColorMatch = {
  paintColorId: string;
  brand: string;
  name: string;
  code: string;
  hex: string;
  deltaE: number;
};

// Brand classes. PAINT = opaque coatings; STAIN = wood stains/finishes.
export const PAINT_BRANDS = [
  "Sherwin-Williams",
  "Benjamin Moore",
  "Behr",
  "PPG",
  "Dunn-Edwards",
  "Valspar",
  "Vista Paint",
] as const;

export const STAIN_BRANDS = [
  "Minwax",
  "General Finishes",
  "Rubio Monocoat",
  "Varathane",
] as const;

// ── sRGB → CIELAB (D65) ──────────────────────────────────────────────────────

function srgbChannelToLinear(c: number): number {
  const cs = c / 255;
  return cs > 0.04045 ? Math.pow((cs + 0.055) / 1.055, 2.4) : cs / 12.92;
}

export function rgbToLab(r: number, g: number, b: number): Lab {
  const R = srgbChannelToLinear(r) * 100;
  const G = srgbChannelToLinear(g) * 100;
  const B = srgbChannelToLinear(b) * 100;

  // sRGB D65 matrix
  const X = R * 0.4124 + G * 0.3576 + B * 0.1805;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = R * 0.0193 + G * 0.1192 + B * 0.9505;

  // D65 reference white
  const Xn = 95.047;
  const Yn = 100.0;
  const Zn = 108.883;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X / Xn);
  const fy = f(Y / Yn);
  const fz = f(Z / Zn);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function hexToLab(hex: string): Lab | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return rgbToLab(rgb[0], rgb[1], rgb[2]);
}

// ── CIEDE2000 ────────────────────────────────────────────────────────────────

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2;

  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  const h1p = Math.atan2(b1, a1p) === 0 ? 0 : (Math.atan2(b1, a1p) * RAD + 360) % 360;
  const h2p = Math.atan2(b2, a2p) === 0 ? 0 : (Math.atan2(b2, a2p) * RAD + 360) % 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * DEG) / 2);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp: number;
  if (C1p * C2p === 0) {
    hbarp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hbarp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    hbarp = (h1p + h2p + 360) / 2;
  } else {
    hbarp = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos((hbarp - 30) * DEG) +
    0.24 * Math.cos(2 * hbarp * DEG) +
    0.32 * Math.cos((3 * hbarp + 6) * DEG) -
    0.2 * Math.cos((4 * hbarp - 63) * DEG);

  const dtheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
  const Cbarp7 = Math.pow(Cbarp, 7);
  const Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + Math.pow(25, 7)));
  const Sl =
    1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(2 * dtheta * DEG) * Rc;

  const kL = 1;
  const kC = 1;
  const kH = 1;

  return Math.sqrt(
    Math.pow(dLp / (kL * Sl), 2) +
      Math.pow(dCp / (kC * Sc), 2) +
      Math.pow(dHp / (kH * Sh), 2) +
      Rt * (dCp / (kC * Sc)) * (dHp / (kH * Sh)),
  );
}

// ── Matching ─────────────────────────────────────────────────────────────────

/**
 * Return the topN closest PaintColor rows to `hex` by CIEDE2000 distance.
 * `colors` are preloaded rows; pass `brands` to restrict to a brand set.
 */
export function matchPaintColors(
  hex: string,
  colors: PaintColorRow[],
  opts: { topN: number; brands?: readonly string[] },
): ColorMatch[] {
  const target = hexToLab(hex);
  if (!target) return [];

  const brandSet = opts.brands ? new Set(opts.brands) : null;

  const scored: ColorMatch[] = [];
  for (const c of colors) {
    if (brandSet && !brandSet.has(c.brand)) continue;
    const lab = rgbToLab(c.r, c.g, c.b);
    const deltaE = deltaE2000(target, lab);
    scored.push({
      paintColorId: c.id,
      brand: c.brand,
      name: c.name,
      code: c.code,
      hex: c.hex,
      deltaE: Math.round(deltaE * 100) / 100,
    });
  }

  scored.sort((a, b) => a.deltaE - b.deltaE);
  return scored.slice(0, opts.topN);
}

export type SurfaceMatches = {
  paints: ColorMatch[];
  stains: ColorMatch[];
  referenceOnly: boolean;
};

/**
 * Surface drives which brand class to search:
 *  - wall/ceiling → paints only
 *  - cabinet/floor/wood → paints AND stains (wood could be painted)
 *  - counter/other → both, flagged reference-only
 */
export function matchesForSurface(
  hex: string,
  surface: string,
  colors: PaintColorRow[],
): SurfaceMatches {
  const s = surface.toLowerCase();
  const wantStains = s === "cabinet" || s === "floor" || s === "wood" || s === "counter" || s === "other";
  const referenceOnly = s === "counter" || s === "other";

  return {
    paints: matchPaintColors(hex, colors, { topN: 3, brands: PAINT_BRANDS }),
    stains: wantStains
      ? matchPaintColors(hex, colors, { topN: 2, brands: STAIN_BRANDS })
      : [],
    referenceOnly,
  };
}

/** ΔE → human label per the honesty rule (reference, not product claim). */
export function matchQualityLabel(deltaE: number): string {
  if (deltaE <= 1) return "Exact match";
  if (deltaE <= 3) return "Very close";
  if (deltaE <= 6) return "Close";
  return "Reference";
}
