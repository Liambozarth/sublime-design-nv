export type ContextGroup = "room" | "feature";

export type ContextDef = {
  slug: string;
  label: string;
  group: ContextGroup;
};

export const CONTEXTS: ContextDef[] = [
  { slug: "living-room", label: "Living Room", group: "room" },
  { slug: "kitchen", label: "Kitchen", group: "room" },
  { slug: "bathroom", label: "Bathroom", group: "room" },
  { slug: "laundry-room", label: "Laundry Room", group: "room" },
  { slug: "bedroom", label: "Bedroom", group: "room" },
  { slug: "office", label: "Office", group: "room" },
  { slug: "primary-bed-bath", label: "Primary Bed/Bath", group: "room" },
  { slug: "great-room", label: "Great Room", group: "room" },
  { slug: "loft", label: "Loft", group: "room" },
  { slug: "tv-wall", label: "TV Wall", group: "feature" },
  { slug: "fireplace-wall", label: "Fireplace Wall", group: "feature" },
  { slug: "pantry", label: "Pantry", group: "feature" },
  { slug: "closet", label: "Closet", group: "feature" },
  { slug: "garage", label: "Garage", group: "feature" },
  { slug: "entryway", label: "Entryway", group: "feature" },
  { slug: "storage", label: "Storage", group: "feature" },
  { slug: "organization", label: "Organization", group: "feature" },
  { slug: "floating-vanity", label: "Floating Vanity", group: "feature" },
  { slug: "led-lighting", label: "LED Lighting", group: "feature" },
  { slug: "coffee-bar", label: "Coffee Bar", group: "feature" },
  { slug: "casita", label: "Casita", group: "feature" },
  { slug: "dining-room", label: "Dining Room", group: "room" },
  { slug: "wet-bar", label: "Wet Bar", group: "feature" },
  { slug: "window-seat", label: "Window Seat", group: "feature" },
];

export type ContextSlug = (typeof CONTEXTS)[number]["slug"];

export function findContext(slug: string) {
  return CONTEXTS.find((context) => context.slug === slug);
}
