import { PROJECT_LIST, sortProjectsForDisplay } from "@/content/projects";
import { FEATURED_REVIEWS, REVIEW_LIST } from "@/content/reviews";
import { ACTIVE_SERVICES } from "@/content/services";

export type AreaStatus = "active" | "coming-soon";

export type AreaDef = {
  slug: string;
  name: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  intro: string;
  heroHeadline: string;
  heroBody: string;
  serviceAreaLabel: string;
  relatedServiceSlugs: string[];
  nearbyAreas: string[];
  status?: AreaStatus;
  coordinates?: { lat: number; lng: number };
};

export const AREA_LIST: AreaDef[] = [
  {
    slug: "summerlin",
    name: "Summerlin",
    title: "Custom Finish Carpentry in Summerlin",
    seoTitle: "Custom Finish Carpentry Summerlin | Sublime Design NV",
    seoDescription:
      "Custom built-ins, floating shelves, cabinetry, and closet systems in Summerlin. Measured, built, and installed by Sublime Design NV.",
    intro:
      "Summerlin projects usually call for clean lines, tight installs, and built-ins that feel like part of the home instead of furniture added after the fact. We handle the measure, build, and install with that standard in mind.",
    heroHeadline: "Custom Carpentry for Summerlin Homes",
    heroBody:
      "Built-ins, floating shelves, cabinetry, closet systems, pantry pullouts, and mantels measured and installed for homes across Summerlin.",
    serviceAreaLabel: "Summerlin",
    relatedServiceSlugs: ["floating-shelves", "built-ins", "custom-cabinetry", "mantels"],
    nearbyAreas: ["las-vegas", "spring-valley", "paradise"],
    status: "active",
  },
  {
    slug: "henderson",
    name: "Henderson",
    title: "Custom Finish Carpentry in Henderson",
    seoTitle: "Custom Finish Carpentry Henderson | Sublime Design NV",
    seoDescription:
      "Custom built-ins, closet systems, pantry pullouts, and cabinetry in Henderson. Shop-built and installed by Sublime Design NV.",
    intro:
      "Henderson homeowners usually want finish carpentry that solves a storage problem and still looks like it belongs with the rest of the house. We build around the room, the wall conditions, and the daily use of the space.",
    heroHeadline: "Measured and Built for Henderson Homes",
    heroBody:
      "Custom finish carpentry in Henderson with a focus on built-ins, closet systems, cabinetry, and clean install work that fits the home.",
    serviceAreaLabel: "Henderson",
    relatedServiceSlugs: ["built-ins", "custom-closets", "pantry-pullouts", "custom-cabinetry"],
    nearbyAreas: ["las-vegas", "paradise", "spring-valley"],
    status: "active",
  },
  {
    slug: "las-vegas",
    name: "Las Vegas",
    title: "Custom Finish Carpentry in Las Vegas",
    seoTitle: "Custom Finish Carpentry Las Vegas | Sublime Design NV",
    seoDescription:
      "Custom floating shelves, built-ins, pantry pullouts, closet systems, cabinetry, and mantels in Las Vegas by Sublime Design NV.",
    intro:
      "Las Vegas projects cover everything from one-wall built-ins to full pantry and closet upgrades. We keep the process straightforward: measure the space, build to fit, and install cleanly.",
    heroHeadline: "Custom Carpentry Across Las Vegas",
    heroBody:
      "Finish carpentry for Las Vegas homes including built-ins, floating shelves, pantry pullouts, closet systems, cabinetry, and mantels.",
    serviceAreaLabel: "Las Vegas",
    relatedServiceSlugs: ["floating-shelves", "built-ins", "pantry-pullouts", "mantels"],
    nearbyAreas: ["summerlin", "spring-valley", "paradise", "henderson"],
    status: "active",
  },
  {
    slug: "spring-valley",
    name: "Spring Valley",
    title: "Custom Finish Carpentry in Spring Valley",
    seoTitle: "Custom Finish Carpentry Spring Valley | Sublime Design NV",
    seoDescription:
      "Custom finish carpentry in Spring Valley with built-ins, cabinetry, closet systems, and floating shelves designed and installed by Sublime Design NV.",
    intro:
      "Spring Valley homes often need practical storage upgrades that still read custom. We build finish carpentry around the exact room dimensions so the result feels intentional and long-term.",
    heroHeadline: "Finish Carpentry for Spring Valley Homes",
    heroBody:
      "Custom built-ins, cabinetry, shelves, and storage systems for homes in Spring Valley and the surrounding Las Vegas Valley.",
    serviceAreaLabel: "Spring Valley",
    relatedServiceSlugs: ["built-ins", "custom-cabinetry", "floating-shelves", "custom-closets"],
    nearbyAreas: ["las-vegas", "summerlin", "paradise"],
    status: "active",
  },
  {
    slug: "paradise",
    name: "Paradise",
    title: "Custom Finish Carpentry in Paradise",
    seoTitle: "Custom Finish Carpentry Paradise | Sublime Design NV",
    seoDescription:
      "Custom finish carpentry in Paradise including cabinetry, built-ins, floating shelves, and pantry pullouts by Sublime Design NV.",
    intro:
      "Paradise projects need the same measured fit and clean install as the rest of the valley. We build the work to the room, keep the details tight, and make the next step clear before install day.",
    heroHeadline: "Custom Carpentry for Paradise Properties",
    heroBody:
      "Measured, built, and installed custom carpentry for homes in Paradise, from built-ins and shelves to pantry and cabinetry upgrades.",
    serviceAreaLabel: "Paradise",
    relatedServiceSlugs: ["built-ins", "floating-shelves", "pantry-pullouts", "custom-cabinetry"],
    nearbyAreas: ["las-vegas", "henderson", "spring-valley"],
    status: "active",
    coordinates: { lat: 36.0800, lng: -115.1372 },
  },
  {
    slug: "lake-las-vegas",
    name: "Lake Las Vegas",
    title: "Custom Finish Carpentry in Lake Las Vegas",
    seoTitle: "Custom Finish Carpentry Lake Las Vegas | Sublime Design NV",
    seoDescription:
      "Custom built-ins, cabinetry, closet systems, and floating shelves in Lake Las Vegas. Measured and installed by Sublime Design NV.",
    intro:
      "Lake Las Vegas homes tend to run toward upscale finishes and resort-influenced design. We build custom carpentry that fits that standard — tight installs, clean lines, and details that hold up to the setting.",
    heroHeadline: "Custom Carpentry for Lake Las Vegas Homes",
    heroBody:
      "Built-ins, cabinetry, floating shelves, closet systems, and mantels measured and installed for homes throughout Lake Las Vegas.",
    serviceAreaLabel: "Lake Las Vegas",
    relatedServiceSlugs: ["built-ins", "custom-cabinetry", "floating-shelves", "mantels"],
    nearbyAreas: ["henderson", "las-vegas", "paradise"],
    status: "active",
    coordinates: { lat: 36.1034, lng: -114.9283 },
  },
  {
    slug: "green-valley-ranch",
    name: "Green Valley Ranch",
    title: "Custom Finish Carpentry in Green Valley Ranch",
    seoTitle: "Custom Finish Carpentry Green Valley Ranch | Sublime Design NV",
    seoDescription:
      "Custom built-ins, pantry pullouts, closet systems, and cabinetry in Green Valley Ranch. Shop-built and installed by Sublime Design NV.",
    intro:
      "Green Valley Ranch homes often call for storage upgrades that blend into the existing layout. We build finish carpentry around the room — pantry systems, closet builds, and built-ins that work with the floor plan, not against it.",
    heroHeadline: "Finish Carpentry for Green Valley Ranch Homes",
    heroBody:
      "Custom pantry pullouts, closet systems, built-ins, and cabinetry installed throughout Green Valley Ranch.",
    serviceAreaLabel: "Green Valley Ranch",
    relatedServiceSlugs: ["pantry-pullouts", "custom-closets", "built-ins", "custom-cabinetry"],
    nearbyAreas: ["henderson", "paradise", "las-vegas"],
    status: "active",
    coordinates: { lat: 36.0147, lng: -115.0572 },
  },
  {
    slug: "anthem",
    name: "Anthem",
    title: "Custom Finish Carpentry in Anthem",
    seoTitle: "Custom Finish Carpentry Anthem Henderson | Sublime Design NV",
    seoDescription:
      "Custom built-ins, closet systems, cabinetry, and floating shelves in Anthem. Measured, built, and installed by Sublime Design NV.",
    intro:
      "Anthem homes are built with quality expectations. We match that standard with finish carpentry that's measured to the room, built in the shop, and installed cleanly — from one-wall built-ins to full closet and pantry systems.",
    heroHeadline: "Custom Carpentry for Anthem Homes",
    heroBody:
      "Built-ins, closet systems, cabinetry, and floating shelves measured and installed for homes across Anthem in Henderson.",
    serviceAreaLabel: "Anthem",
    relatedServiceSlugs: ["built-ins", "custom-closets", "custom-cabinetry", "floating-shelves"],
    nearbyAreas: ["henderson", "green-valley-ranch", "las-vegas", "southern-highlands"],
    status: "active",
    coordinates: { lat: 35.9727, lng: -115.0845 },
  },
  {
    slug: "red-rock",
    name: "Red Rock",
    title: "Custom Finish Carpentry near Red Rock",
    seoTitle: "Custom Finish Carpentry Red Rock Las Vegas | Sublime Design NV",
    seoDescription:
      "Custom built-ins, floating shelves, mantels, and cabinetry for homes near Red Rock. Installed by Sublime Design NV.",
    intro:
      "Homes near Red Rock tend toward natural materials and open design. We build custom carpentry that fits that aesthetic — floating shelves, built-ins, and mantels with clean profiles and finishes that complement the surroundings.",
    heroHeadline: "Custom Carpentry for Red Rock Area Homes",
    heroBody:
      "Floating shelves, built-ins, mantels, and cabinetry installed for homes near the Red Rock area of Las Vegas.",
    serviceAreaLabel: "Red Rock",
    relatedServiceSlugs: ["floating-shelves", "built-ins", "mantels", "custom-cabinetry"],
    nearbyAreas: ["summerlin", "las-vegas", "spring-valley"],
    status: "active",
    coordinates: { lat: 36.1617, lng: -115.4228 },
  },
  {
    slug: "centennial-hills",
    name: "Centennial Hills",
    title: "Custom Finish Carpentry in Centennial Hills",
    seoTitle: "Custom Finish Carpentry Centennial Hills | Sublime Design NV",
    seoDescription:
      "Custom built-ins, pantry pullouts, closet systems, and cabinetry in Centennial Hills. Measured and installed by Sublime Design NV.",
    intro:
      "Centennial Hills is one of the faster-growing parts of the valley, and newer homes here often need the custom storage built-in work the original build left out. We fill those gaps with finish carpentry that fits the home and the daily routine.",
    heroHeadline: "Custom Carpentry for Centennial Hills Homes",
    heroBody:
      "Custom pantry pullouts, built-ins, closet systems, and cabinetry installed throughout Centennial Hills.",
    serviceAreaLabel: "Centennial Hills",
    relatedServiceSlugs: ["pantry-pullouts", "built-ins", "custom-closets", "custom-cabinetry"],
    nearbyAreas: ["las-vegas", "summerlin", "north-las-vegas"],
    status: "active",
    coordinates: { lat: 36.2684, lng: -115.2617 },
  },
  {
    slug: "north-las-vegas",
    name: "North Las Vegas",
    title: "Custom Finish Carpentry in North Las Vegas",
    seoTitle: "Custom Finish Carpentry North Las Vegas | Sublime Design NV",
    seoDescription:
      "Custom built-ins, floating shelves, cabinetry, and closet systems in North Las Vegas. Shop-built and installed by Sublime Design NV.",
    intro:
      "North Las Vegas homes range from older builds that need storage updated to newer construction that needs built-ins added. We measure the space, build in the shop, and install cleanly regardless of the existing conditions.",
    heroHeadline: "Finish Carpentry for North Las Vegas Homes",
    heroBody:
      "Custom built-ins, floating shelves, closet systems, and cabinetry installed throughout North Las Vegas.",
    serviceAreaLabel: "North Las Vegas",
    relatedServiceSlugs: ["built-ins", "floating-shelves", "custom-closets", "custom-cabinetry"],
    nearbyAreas: ["las-vegas", "centennial-hills", "paradise"],
    status: "active",
    coordinates: { lat: 36.1989, lng: -115.1175 },
  },
  {
    slug: "rhodes-ranch",
    name: "Rhodes Ranch",
    title: "Custom Finish Carpentry in Rhodes Ranch",
    seoTitle: "Custom Finish Carpentry Rhodes Ranch | Sublime Design NV",
    seoDescription:
      "Custom built-ins, cabinetry, closet systems, and floating shelves in Rhodes Ranch. Measured and installed by Sublime Design NV.",
    intro:
      "Rhodes Ranch homes sit in a gated community with consistent quality standards. We build finish carpentry to match — clean installs, tight details, and work that looks like it came with the house.",
    heroHeadline: "Custom Carpentry for Rhodes Ranch Homes",
    heroBody:
      "Built-ins, cabinetry, closet systems, and floating shelves measured and installed for homes in Rhodes Ranch.",
    serviceAreaLabel: "Rhodes Ranch",
    relatedServiceSlugs: ["built-ins", "custom-cabinetry", "custom-closets", "floating-shelves"],
    nearbyAreas: ["spring-valley", "summerlin", "las-vegas", "southern-highlands"],
    status: "active",
    coordinates: { lat: 36.0598, lng: -115.2641 },
  },
  {
    slug: "seven-hills",
    name: "Seven Hills",
    title: "Custom Finish Carpentry in Seven Hills",
    seoTitle: "Custom Finish Carpentry Seven Hills Henderson | Sublime Design NV",
    seoDescription:
      "Custom built-ins, cabinetry, closet systems, and mantels in Seven Hills. Measured, built, and installed by Sublime Design NV.",
    intro:
      "Seven Hills homes in Henderson are built at a high standard and need finish carpentry to match. We build custom work for these homes — from full closet systems and pantry pullouts to built-ins and mantels that fit the space exactly.",
    heroHeadline: "Custom Carpentry for Seven Hills Homes",
    heroBody:
      "Custom built-ins, cabinetry, closet systems, and mantels installed for homes throughout Seven Hills in Henderson.",
    serviceAreaLabel: "Seven Hills",
    relatedServiceSlugs: ["built-ins", "custom-cabinetry", "custom-closets", "mantels"],
    nearbyAreas: ["henderson", "green-valley-ranch", "anthem", "southern-highlands"],
    status: "active",
    coordinates: { lat: 36.0024, lng: -114.9767 },
  },
  {
    slug: "southern-highlands",
    name: "Southern Highlands",
    title: "Custom Finish Carpentry in Southern Highlands",
    seoTitle: "Custom Finish Carpentry Southern Highlands | Sublime Design NV",
    seoDescription:
      "Custom built-ins, closet systems, cabinetry, and floating shelves in Southern Highlands. Measured, built, and installed by Sublime Design NV.",
    intro:
      "Southern Highlands is a guard-gated golf community of custom homes in the south Las Vegas Valley, and the finish work needs to match that standard. We build custom carpentry measured to the room, fabricated in the shop, and installed cleanly — from full closet systems and built-ins to cabinetry and mantels.",
    heroHeadline: "Custom Carpentry for Southern Highlands Homes",
    heroBody:
      "Built-ins, closet systems, cabinetry, and floating shelves measured and installed for custom homes across Southern Highlands in south Las Vegas.",
    serviceAreaLabel: "Southern Highlands",
    relatedServiceSlugs: ["built-ins", "custom-closets", "custom-cabinetry", "floating-shelves"],
    nearbyAreas: ["anthem", "rhodes-ranch", "seven-hills"],
    status: "active",
    coordinates: { lat: 35.9735, lng: -115.1898 },
  },
];

export const ACTIVE_AREAS = AREA_LIST.filter((area) => (area.status ?? "active") === "active");

/** Ordered display names for upload/project location pickers — includes "Other" at the end. */
export const AREA_NAMES = [
  ...ACTIVE_AREAS.map((area) => area.name),
  "Other",
] as const;

export function findArea(slug: string) {
  return AREA_LIST.find((area) => area.slug === slug);
}

export function getAllAreaSlugs() {
  return ACTIVE_AREAS.map((area) => area.slug);
}

export function getAreaProjects(areaSlug: string) {
  return sortProjectsForDisplay(
    PROJECT_LIST.filter((project) => project.location.city === areaSlug),
  );
}

export function getAreaServices(areaSlug: string) {
  const area = findArea(areaSlug);
  if (!area) return [];

  return area.relatedServiceSlugs
    .map((slug) => ACTIVE_SERVICES.find((service) => service.slug === slug))
    .filter((service): service is NonNullable<typeof service> => Boolean(service));
}

export function getAreaReviews(areaSlug: string) {
  const matching = getDirectAreaReviews(areaSlug);
  return matching.length ? matching : FEATURED_REVIEWS.slice(0, 2);
}

export function getDirectAreaReviews(areaSlug: string) {
  const area = findArea(areaSlug);
  if (!area) return [];

  const areaProjects = new Set(getAreaProjects(areaSlug).map((project) => project.slug));
  return REVIEW_LIST.filter((review) => {
    const locationMatch = review.location.toLowerCase().includes(area.name.toLowerCase());
    const projectMatch = review.projectSlug ? areaProjects.has(review.projectSlug) : false;
    return locationMatch || projectMatch;
  });
}
