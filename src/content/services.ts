export type ServiceStatus = "active" | "coming-soon";

export type FaqItem = {
  question: string;
  answer: string;
};

export type ServiceCaseStudyMeta = {
  projectSlug?: string;
  projectTitle?: string;
  location?: string;
  summary?: string;
};

export type ServiceDef = {
  slug: string;
  title: string;
  shortTitle: string;
  navLabel: string;
  description: string;
  shortDescription: string;
  heroHeadline: string;
  heroBody: string;
  introParagraph: string;
  valueBullets: string[];
  processSteps: [string, string, string];
  faq: FaqItem[];
  relatedServices: string[];
  seoTitle: string;
  seoDescription: string;
  ctaLabel: string;
  sortOrder: number;
  aliases: string[];
  status: ServiceStatus;
  caseStudy?: ServiceCaseStudyMeta;
};

export const SERVICE_LIST: ServiceDef[] = [
  {
    slug: "floating-shelves",
    title: "Custom Floating Shelves",
    shortTitle: "Floating Shelves",
    navLabel: "Floating Shelves",
    description:
      "Custom floating shelves for Las Vegas homes, built in plywood or MDF with stain-grade or paint-grade finishes, concealed support, and optional integrated lighting details.",
    shortDescription:
      "Premium shelves with concealed support, clean reveals, and optional integrated lighting.",
    heroHeadline: "Floating Shelves Built to Read Clean and Carry Weight",
    heroBody:
      "We build and install custom floating shelves with concealed support, premium finish options, and clean alignment tied to the wall, room, and final styling plan.",
    introParagraph:
      "Floating shelves should feel architectural, not added later. We size every run to the wall, account for real weight loads, and build the shelves around the finish direction you want: paint-grade, stain-grade, lighting-ready, or heavy-duty support for books and display pieces. The goal is simple: shelves that look refined from across the room and still perform day to day.",
    valueBullets: [
      "Paint-grade or stain-grade shelves built around the wall and final finish plan",
      "Custom sizing and spacing tied to the room, layout, and display needs",
      "Optional LED tape lighting, puck lighting, and transformer integration",
      "Heavy-duty concealed support options for longer spans and real storage weight",
    ],
    processSteps: [
      "Measure the wall, confirm shelf depth, spacing, load expectations, and finish direction",
      "Fabricate the shelves and support system for the exact wall and bracket layout",
      "Install, level, and finish the run so it reads like built-in millwork",
    ],
    faq: [
      {
        question: "Can floating shelves include integrated lighting?",
        answer:
          "Yes. We can build shelves for flush LED tape lighting, puck lighting, and transformer integration when the wall and electrical plan support it.",
      },
      {
        question: "Do you build stain-grade and paint-grade shelves?",
        answer:
          "Yes. We build both, typically in plywood or MDF depending on the finish goal, shelf depth, and final look.",
      },
      {
        question: "Can floating shelves handle heavy books or decor?",
        answer:
          "Yes, when the wall conditions and bracket layout are planned for it. We offer heavy-duty concealed support upgrades for longer spans and heavier loads.",
      },
    ],
    relatedServices: ["media-walls", "mantels", "faux-beams"],
    seoTitle: "Floating Shelves Las Vegas | Sublime Design NV",
    seoDescription:
      "Custom floating shelves in Las Vegas, Henderson, and Summerlin with concealed support, premium finishes, and optional integrated lighting.",
    ctaLabel: "Get a Floating Shelf Quote",
    sortOrder: 1,
    aliases: [],
    status: "active",
  },
  {
    slug: "media-walls",
    title: "Custom Media Walls",
    shortTitle: "Media Walls",
    navLabel: "Media Walls",
    description:
      "Custom media walls and feature installations with cabinetry, shelving, fireplace bump-outs, and finish carpentry details built for a clean focal wall.",
    shortDescription:
      "TV walls, built-in feature walls, fireplace bump-outs, and integrated shelving.",
    heroHeadline: "Media Walls That Turn One Wall into the Focal Point",
    heroBody:
      "We build custom media walls, feature walls, and integrated built-in wall systems with shelves, cabinetry, trim details, and clean site-fit installation.",
    introParagraph:
      "The best media walls are not just TV backdrops. They solve layout, storage, and finish problems in one move. We build custom feature walls that can combine shelving, cabinetry, shiplap or panel details, fireplace bump-outs, and trim work into one measured installation. That makes them a strong fit for higher-ticket living room, office, and family-room upgrades where the wall needs to do more than hold a screen.",
    valueBullets: [
      "TV wall units and feature walls built for a cleaner finished focal point",
      "Fireplace bump-out integration planned into the full wall layout",
      "Shelves and cabinetry options coordinated as one continuous installation",
      "Built for a clean finished look instead of pieced-together add-ons",
    ],
    processSteps: [
      "Review the wall, TV/fireplace layout, storage needs, and finish direction",
      "Build the wall system in sections with cabinetry, shelving, and trim details coordinated together",
      "Install, fit, and hand off a clean focal wall ready for final styling or paint",
    ],
    faq: [
      {
        question: "Do media walls always include a TV?",
        answer:
          "No. Many projects center around a TV, but we also build feature walls with shelving, cabinetry, fireplace surrounds, and display-focused layouts.",
      },
      {
        question: "Can a media wall include shelves and lower cabinets?",
        answer:
          "Yes. That is one of the main reasons homeowners hire us for this category. We can combine shelving, cabinetry, and trim details into one wall system.",
      },
      {
        question: "Is this the right category for a built-in wall unit?",
        answer:
          "Yes. Built-in wall units, entertainment walls, and custom feature walls all fall under our media wall category in this service structure.",
      },
    ],
    relatedServices: ["floating-shelves", "cabinets", "trim"],
    seoTitle: "Media Walls Las Vegas | Sublime Design NV",
    seoDescription:
      "Custom media walls in Las Vegas, Henderson, and Summerlin with shelving, cabinetry, fireplace bump-outs, and premium finish carpentry details.",
    ctaLabel: "Get a Media Wall Quote",
    sortOrder: 2,
    aliases: ["built-ins"],
    status: "active",
  },
  {
    slug: "faux-beams",
    title: "Custom Faux Beams",
    shortTitle: "Faux Beams",
    navLabel: "Faux Beams",
    description:
      "Plywood-only faux beams with mitered corners, stain or paint finishes, lightweight installation, and custom sizing for Las Vegas Valley homes.",
    shortDescription:
      "Plywood faux beams with seamless mitered corners and custom finish options.",
    heroHeadline: "Faux Beams with a Clean Seamless Look",
    heroBody:
      "We build lightweight plywood faux beams with mitered corners, custom sizing, and stain or paint finishes so the final install reads intentional instead of decorative filler.",
    introParagraph:
      "Faux beams should add architectural weight without adding structural complexity. Our faux beam work focuses on plywood construction, tight mitered corners, clean seam lines, and finish options that match the rest of the room. The goal is a custom-looking ceiling detail that installs cleanly, keeps weight down, and still reads premium in a finished living room, kitchen, or entry space.",
    valueBullets: [
      "Plywood beam construction sized for a lighter cleaner installation",
      "Mitered corners for a more seamless look from below and across the room",
      "Paint or stain finish options matched to the room direction",
      "Custom sizing for your room with optional decorative beam straps",
    ],
    processSteps: [
      "Confirm span, beam scale, ceiling conditions, and finish direction",
      "Fabricate plywood beam wraps with clean mitered corners and site-fit dimensions",
      "Install the beam system cleanly with optional strap details if desired",
    ],
    faq: [
      {
        question: "Are your faux beams structural?",
        answer:
          "No. These are finish-carpentry beam wraps built for visual impact, not load-bearing use.",
      },
      {
        question: "Why plywood-only construction?",
        answer:
          "Plywood keeps the beams lighter, more stable, and easier to fabricate cleanly with tight mitered corners and a consistent final finish.",
      },
      {
        question: "Are beam straps required?",
        answer:
          "No. Beam straps are optional. We treat them as a finish detail, not a separate category or default requirement.",
      },
    ],
    relatedServices: ["mantels", "trim", "floating-shelves"],
    seoTitle: "Faux Beams Las Vegas | Sublime Design NV",
    seoDescription:
      "Custom faux beams in Las Vegas with plywood construction, mitered corners, stain or paint finishes, and lightweight installation.",
    ctaLabel: "Get a Faux Beam Quote",
    sortOrder: 3,
    aliases: [],
    status: "active",
  },
  {
    slug: "barn-doors",
    title: "Custom Barn Doors",
    shortTitle: "Barn Doors",
    navLabel: "Barn Doors",
    description:
      "Custom barn doors built to fit the opening, finished to match the home, and installed with hardware included for daily use.",
    shortDescription:
      "Custom-size barn doors with finish options, hardware, and installation included.",
    heroHeadline: "Barn Doors Built to Fit the Opening and the Finish Plan",
    heroBody:
      "We build custom barn doors in the size, finish, and hardware setup your opening needs, then install the full system so it works cleanly every day.",
    introParagraph:
      "Barn doors only feel premium when the door size, track hardware, finish, and install all work together. We build around the opening instead of trying to force a stock panel to fit. That means better proportions, cleaner operation, and a finish that looks like it belongs with the rest of the home. Hardware and install are part of the job, not afterthought add-ons.",
    valueBullets: [
      "Custom built for the exact opening and wall conditions",
      "Paint or stain finish options matched to the room direction",
      "Hardware packages included as part of the full barn door scope",
      "Installed cleanly and aligned correctly for everyday use",
    ],
    processSteps: [
      "Measure the opening, wall clearance, and hardware path",
      "Build and finish the door for the selected style, size, and hardware package",
      "Install the track, hang the door, and tune operation on site",
    ],
    faq: [
      {
        question: "Do you include the hardware?",
        answer:
          "Yes. Hardware selection and installation are part of the barn door scope so the full system works together.",
      },
      {
        question: "Can the door be stained or painted?",
        answer:
          "Yes. We offer both stain and paint directions depending on the design and material choice.",
      },
      {
        question: "Are barn doors built to custom sizes?",
        answer:
          "Yes. We build to the actual opening and wall conditions instead of relying on stock slab sizes.",
      },
    ],
    relatedServices: ["trim", "cabinets", "floating-shelves"],
    seoTitle: "Barn Doors Las Vegas | Sublime Design NV",
    seoDescription:
      "Custom barn doors in Las Vegas with custom sizing, hardware included, stain or paint finish options, and professional installation.",
    ctaLabel: "Get a Barn Door Quote",
    sortOrder: 4,
    aliases: [],
    status: "active",
  },
  {
    slug: "mantels",
    title: "Custom Mantels",
    shortTitle: "Mantels",
    navLabel: "Mantels",
    description:
      "Floating mantels and crown molding mantels designed around your fireplace and wall proportions, built to create a stronger finished focal point.",
    shortDescription:
      "Floating mantels and full fireplace mantel builds sized to the room.",
    heroHeadline: "Mantels That Give the Fireplace Real Presence",
    heroBody:
      "We build custom mantels and surrounds that fit the fireplace, wall, and room proportions so the finished install feels intentional from day one.",
    introParagraph:
      "A mantel should give the fireplace presence, not just trim out the opening. We build floating mantels and crown molding mantel surrounds with the right scale, shelf depth, and finish details for the room. Whether the goal is a cleaner modern ledge or a more detailed surround, we keep the work measured, proportioned, and install-ready.",
    valueBullets: [
      "Floating mantel styles for cleaner modern fireplace upgrades",
      "Classic crown molding mantel options for more detailed surrounds",
      "Custom sizing and finish selection tied to the fireplace and room",
      "Built to give the fireplace stronger focal-point presence",
    ],
    processSteps: [
      "Measure the fireplace opening, wall width, and target proportions",
      "Fabricate the shelf or surround in the selected profile and finish direction",
      "Install, align, and hand off a cleaner finished focal point",
    ],
    faq: [
      {
        question: "Do you build simple floating mantels and full surrounds?",
        answer:
          "Yes. We handle both floating mantel shelves and more detailed crown molding mantel surrounds.",
      },
      {
        question: "Can the mantel be stain-grade or paint-grade?",
        answer:
          "Yes. We build both depending on the style direction and finish plan for the room.",
      },
      {
        question: "Do you already offer hidden-storage mantels?",
        answer:
          "Not as a primary public category yet, but the mantel system is positioned so that upgrade path can be added later cleanly.",
      },
    ],
    relatedServices: ["faux-beams", "media-walls", "trim"],
    seoTitle: "Mantels Las Vegas | Sublime Design NV",
    seoDescription:
      "Custom mantels in Las Vegas, Henderson, and Summerlin including floating mantels and crown molding surrounds built to fit the room.",
    ctaLabel: "Get a Mantel Quote",
    sortOrder: 5,
    aliases: [],
    status: "active",
  },
  {
    slug: "cabinets",
    title: "Custom Cabinets",
    shortTitle: "Cabinets",
    navLabel: "Cabinets",
    description:
      "RTA and custom cabinet solutions for kitchens, storage walls, pantry upgrades, mudrooms, and other practical built-in storage problems.",
    shortDescription:
      "RTA and custom cabinets for kitchens, storage upgrades, and practical built-in solutions.",
    heroHeadline: "Cabinets That Fit the Space Instead of Fighting It",
    heroBody:
      "We handle cabinet installs and custom cabinet solutions with cleaner fit, better storage planning, and practical layouts for everyday use.",
    introParagraph:
      "Cabinet work does not need an overbuilt taxonomy to be useful. The real question is whether the final layout solves the storage problem and fits the room cleanly. We handle both RTA and custom cabinets, and the page copy can speak to face-frame, frameless, Euro, or retrofit details as needed without splitting the site into too many categories. That keeps the public structure simple while still covering kitchens, mudrooms, pantry upgrades, and cabinet-based storage projects.",
    valueBullets: [
      "RTA and custom cabinet solutions sized around layout and function",
      "Euro or frameless and more traditional cabinet directions handled in one category",
      "Fast-turnaround paths available when the scope and cabinet type allow it",
      "Good fit for pantry upgrades, mudrooms, storage walls, and kitchen support work",
    ],
    processSteps: [
      "Review the room, layout goals, cabinet type, and storage priorities",
      "Confirm sizing, finish direction, filler details, and hardware approach",
      "Install and adjust the cabinets for clean operation and finished alignment",
    ],
    faq: [
      {
        question: "Do you work with RTA and custom cabinets?",
        answer:
          "Yes. We handle both. The right choice depends on budget, layout, finish expectations, and how custom the room needs to be.",
      },
      {
        question: "Is this the right category for pantry upgrades or pullouts?",
        answer:
          "Yes. Pantry cabinet upgrades, pullouts, and cabinet-based storage improvements all live under Cabinets in this service structure.",
      },
      {
        question: "Is this the right category for closet or mudroom-style cabinet work?",
        answer:
          "If the job is primarily cabinetry or storage-driven, yes. We keep those projects inside Cabinets rather than splitting them into too many top-level categories.",
      },
    ],
    relatedServices: ["media-walls", "trim", "floating-shelves"],
    seoTitle: "Cabinets Las Vegas | Sublime Design NV",
    seoDescription:
      "Cabinet installs and custom cabinet solutions in Las Vegas for kitchens, pantry upgrades, mudrooms, and practical storage projects.",
    ctaLabel: "Get a Cabinet Quote",
    sortOrder: 6,
    aliases: ["custom-cabinetry", "pantry-pullouts", "pantry", "closet-systems", "closets"],
    status: "active",
  },
  {
    slug: "custom-closets",
    title: "Custom Closets",
    shortTitle: "Custom Closets",
    navLabel: "Custom Closets",
    description:
      "Custom closet systems for Las Vegas homes — walk-in closets, reach-in closets, closet islands, shoe walls, and vanity towers built to fit the space in melamine and TFL.",
    shortDescription:
      "Walk-in and reach-in closet systems, islands, shoe walls, and vanity towers built to fit.",
    heroHeadline: "Closets Built Around How You Actually Use the Space",
    heroBody:
      "We design and build custom closet systems for Las Vegas homes — walk-in and reach-in layouts, closet islands, shoe walls, and vanity towers measured to the room and installed clean.",
    introParagraph:
      "A good closet system is about fit and function, not just shelving. We build walk-in and reach-in closets around the real dimensions of the room, the way you store clothing and shoes, and the finish direction you want. That covers hanging sections, drawer banks, shoe walls, vanity towers, closet islands, and glass-front uppers — built in durable melamine and TFL systems and installed to look like part of the home. Whether the goal is a full walk-in build or a cleaner reach-in upgrade, we keep the layout practical and the install tight.",
    valueBullets: [
      "Walk-in and reach-in closet systems sized to the room and your storage habits",
      "Closet islands, shoe walls, vanity towers, and drawer banks built into the layout",
      "Durable melamine and TFL systems in a range of textures and colors",
      "Glass-front uppers and finish details for a more custom, furniture-grade look",
    ],
    processSteps: [
      "Measure the closet, review storage needs, hanging vs. drawer ratio, and finish direction",
      "Design and fabricate the system — sections, island, shoe wall, and towers — to fit the space",
      "Install and adjust the system for clean operation and a built-to-fit finished look",
    ],
    faq: [
      {
        question: "Do you build walk-in and reach-in closets?",
        answer:
          "Yes. We build both. Walk-in systems can include islands, vanity towers, and shoe walls, while reach-in closets focus on maximizing a smaller footprint cleanly.",
      },
      {
        question: "What materials do you use for closet systems?",
        answer:
          "We build primarily in melamine and TFL systems for durability and a wide range of textures and colors, with glass-front uppers and finish upgrades available.",
      },
      {
        question: "Can a closet include a center island or vanity tower?",
        answer:
          "Yes. Closet islands, vanity towers, drawer banks, and shoe walls can all be designed into the layout when the room dimensions support it.",
      },
    ],
    relatedServices: ["cabinets", "floating-shelves", "trim"],
    seoTitle: "Custom Closets Las Vegas | Sublime Design NV",
    seoDescription:
      "Custom closet systems in Las Vegas, Henderson, and Summerlin — walk-in and reach-in closets, islands, shoe walls, and vanity towers built to fit in melamine and TFL.",
    ctaLabel: "Get a Custom Closet Quote",
    sortOrder: 10,
    aliases: [],
    status: "active",
  },
  {
    slug: "feature-wall",
    title: "Feature Walls",
    shortTitle: "Feature Walls",
    navLabel: "Feature Walls",
    description:
      "Custom feature wall panels, shiplap, board and batten, and architectural wall details built to create a single strong focal point in living rooms, bedrooms, and entryways.",
    shortDescription:
      "Shiplap, board and batten, panel details, and custom focal wall treatments.",
    heroHeadline: "Feature Walls That Change How the Room Reads",
    heroBody:
      "We build custom feature walls with shiplap, board and batten, panel systems, and trim details designed to make one wall the clear focal point of the room.",
    introParagraph:
      "A strong feature wall does not need a lot of material — it needs the right proportions, clean execution, and a finish that ties the room together. We build shiplap walls, board and batten walls, panel feature walls, and mixed-trim focal walls sized to the room and ready for paint. The result is a wall that reads intentional instead of wallpapered over.",
    valueBullets: [
      "Shiplap, vertical shiplap, board and batten, and panel wall options",
      "Custom sizing and layout tied to the wall and room proportions",
      "Paint-grade finishes built to match the room direction",
      "Clean installs that read architectural instead of decorative",
    ],
    processSteps: [
      "Measure the wall and confirm layout, profile, and finish direction",
      "Build and prep the feature wall panels or trim layout for the exact site conditions",
      "Install, tune reveals and joints, and hand off a clean finished focal wall",
    ],
    faq: [
      {
        question: "What types of feature walls do you build?",
        answer:
          "We build shiplap walls, vertical shiplap, board and batten, and custom panel feature walls. All are paint-grade and sized to the room.",
      },
      {
        question: "Is this the same as your Trim & Finish category?",
        answer:
          "Feature walls are a more focused category for dedicated focal wall projects. Full trim packages — baseboard, casing, crown — live under Trim & Finish.",
      },
      {
        question: "Can a feature wall include integrated shelves or a TV area?",
        answer:
          "Yes. Feature walls that include shelving or a media section are a good fit for our Media Walls category, which handles the full integrated build.",
      },
    ],
    relatedServices: ["media-walls", "trim", "floating-shelves"],
    seoTitle: "Feature Walls Las Vegas | Sublime Design NV",
    seoDescription:
      "Custom feature walls in Las Vegas with shiplap, board and batten, panel details, and clean paint-grade finishes built to transform a single focal wall.",
    ctaLabel: "Get a Feature Wall Quote",
    sortOrder: 8,
    aliases: [],
    status: "active",
  },
  {
    slug: "led-lighting",
    title: "LED Lighting",
    shortTitle: "LED Lighting",
    navLabel: "LED Lighting",
    description:
      "Integrated LED tape lighting, puck lighting, and transformer installations built into shelves, cabinets, faux beams, and architectural millwork details.",
    shortDescription:
      "LED tape, puck lighting, and transformer installs integrated into millwork details.",
    heroHeadline: "LED Lighting Built Into the Millwork, Not Added After",
    heroBody:
      "We install integrated LED lighting as part of the millwork scope — tape lighting under shelves, puck lighting in cabinets, and transformer setups that work cleanly with the finished detail.",
    introParagraph:
      "LED lighting works best when it is planned into the millwork from the start, not stapled on after installation. We handle LED tape lighting under shelves, puck lighting in cabinet interiors, and transformer wiring built into the detail so the final install looks clean. The lighting scope can be added to a shelf, cabinet, beam, or feature wall project, or quoted as a standalone upgrade to an existing detail.",
    valueBullets: [
      "LED tape lighting sized and cut for shelf undersides and beam details",
      "Puck lighting for cabinet interiors and display-focused millwork",
      "Transformer and driver integration planned into the install, not added after",
      "Works as an add-on to a shelf, cabinet, or beam project or as a standalone scope",
    ],
    processSteps: [
      "Review the detail, lighting type, and transformer location options",
      "Run and connect the LED system with clean wire management inside the millwork",
      "Test, tune, and hand off a finished lighting install that reads built-in",
    ],
    faq: [
      {
        question: "Do you handle tape lighting and puck lighting?",
        answer:
          "Yes. We install both LED tape lighting for shelf and beam details and puck lighting for cabinet and display-focused millwork.",
      },
      {
        question: "Is the transformer included?",
        answer:
          "We plan and install the transformer or driver as part of the lighting scope. The scope depends on the detail, run length, and power source location.",
      },
      {
        question: "Can I add LED lighting to an existing shelf or cabinet install?",
        answer:
          "Yes. Lighting upgrades to existing millwork are a common standalone scope when the existing detail has room for a clean install.",
      },
    ],
    relatedServices: ["floating-shelves", "cabinets", "faux-beams"],
    seoTitle: "LED Lighting Las Vegas | Sublime Design NV",
    seoDescription:
      "Integrated LED lighting in Las Vegas for floating shelves, cabinets, faux beams, and millwork details including tape lighting, puck lighting, and transformer installs.",
    ctaLabel: "Get an LED Lighting Quote",
    sortOrder: 9,
    aliases: ["lighting", "led"],
    status: "active",
  },
  {
    slug: "trim",
    title: "Trim & Finish Carpentry",
    shortTitle: "Trim & Finish",
    navLabel: "Trim & Finish",
    description:
      "Finish carpentry upgrades including baseboard, casing, crown, shiplap, wainscoting, feature walls, board and batten, and vertical shiplap.",
    shortDescription:
      "Baseboard, casing, crown, shiplap, wainscoting, and detail-driven finish carpentry.",
    heroHeadline: "Trim Work That Tightens Up the Whole Room",
    heroBody:
      "We handle trim and finish carpentry upgrades that sharpen the room, from clean base and casing packages to full feature-wall treatments.",
    introParagraph:
      "Trim work is where sloppy installs show immediately. We keep this category focused on finish details that actually move the room forward: baseboard, casing, crown, shiplap, wainscoting, board and batten, vertical shiplap, and other feature-wall upgrades. The work stays premium when the cuts are clean, the reveals stay consistent, and the final install looks integrated instead of patched together.",
    valueBullets: [
      "Baseboard, casing, crown, and detail work that tightens up the room",
      "Shiplap, board and batten, and feature wall finish carpentry",
      "Clean finished installs with tighter reveals and cleaner transitions",
      "A strong upgrade path for builder-grade spaces that need more detail",
    ],
    processSteps: [
      "Review the room, profiles, wall conditions, and finish direction",
      "Cut and prep the trim package or feature-wall layout for the exact site conditions",
      "Install, tune joints and reveals, and hand off a cleaner finished room",
    ],
    faq: [
      {
        question: "Do you handle full trim packages or just one wall?",
        answer:
          "Both. Some projects are a full room package, and others are a single feature wall or targeted trim upgrade.",
      },
      {
        question: "Is shiplap part of this category?",
        answer:
          "Yes. Shiplap, vertical shiplap, board and batten, and similar wall treatments all live under Trim & Finish.",
      },
      {
        question: "Do you keep faux beams under trim?",
        answer:
          "No. Faux Beams is its own top-level category in this site structure.",
      },
    ],
    relatedServices: ["media-walls", "faux-beams", "cabinets"],
    seoTitle: "Trim & Finish Carpentry Las Vegas | Sublime Design NV",
    seoDescription:
      "Trim and finish carpentry in Las Vegas including baseboard, casing, crown, shiplap, wainscoting, and premium feature-wall installs.",
    ctaLabel: "Get a Trim & Finish Quote",
    sortOrder: 7,
    aliases: ["trim-work"],
    status: "active",
  },
];

const SERVICE_ORDER = [
  "barn-doors",
  "floating-shelves",
  "mantels",
  "media-walls",
  "faux-beams",
  "cabinets",
  "custom-closets",
  "trim",
  "feature-wall",
  "led-lighting",
] as const;

const SERVICE_ORDER_INDEX = new Map(
  SERVICE_ORDER.map((slug, index) => [slug, index] as const),
);

export const ACTIVE_SERVICES = [...SERVICE_LIST]
  .filter((service) => service.status === "active")
  .sort(
    (a, b) =>
      (SERVICE_ORDER_INDEX.get(a.slug as (typeof SERVICE_ORDER)[number]) ?? Number.MAX_SAFE_INTEGER) -
      (SERVICE_ORDER_INDEX.get(b.slug as (typeof SERVICE_ORDER)[number]) ?? Number.MAX_SAFE_INTEGER),
  );

export const HOMEPAGE_PRIMARY_SERVICES = ACTIVE_SERVICES.slice(0, 4);

export const HOMEPAGE_SECONDARY_SERVICES = ACTIVE_SERVICES.slice(4);

export const SERVICES = ACTIVE_SERVICES.map((service) => ({
  slug: service.slug,
  label: service.shortTitle,
}));

export const CANONICAL_SERVICE_SLUGS = ACTIVE_SERVICES.map((service) => service.slug);

export type CanonicalServiceSlug = (typeof CANONICAL_SERVICE_SLUGS)[number];
export function findService(slug: string): ServiceDef | undefined {
  return SERVICE_LIST.find((service) => service.slug === slug || service.aliases.includes(slug));
}

export function findCanonicalService(slug: string): ServiceDef | undefined {
  return ACTIVE_SERVICES.find((service) => service.slug === slug);
}

export function getServiceLookupSlugs(slug: string): string[] {
  const service = findService(slug);
  if (!service) return [slug];
  return [service.slug, ...service.aliases];
}

export function getServiceMeta(slug: string): ServiceDef | null {
  return findService(slug) ?? null;
}

export function getAllServiceSlugs(): string[] {
  return SERVICE_LIST.flatMap((service) => [service.slug, ...service.aliases]);
}

export function isCanonicalServiceSlug(slug: string): slug is CanonicalServiceSlug {
  return CANONICAL_SERVICE_SLUGS.includes(slug as CanonicalServiceSlug);
}
