export const SITE = {
  name: "Sublime Design NV",
  tagline: "Custom Woodwork. Elevated.",
  url: "https://sublimedesignnv.com",
  phone: "702-847-9016",
  phoneHref: "tel:+17028479016",
  email: "info@sublimedesignnv.com",
  emailHref: "mailto:info@sublimedesignnv.com",
  address: "6325 S Pecos Rd #14, Las Vegas NV 89120",
  addressHref:
    "https://www.google.com/maps?q=6325+S+Pecos+Rd+%2314,+Las+Vegas+NV+89120",
  hours: {
    weekdays: "Monday–Thursday 8AM–4PM",
    weekend: "Friday–Sunday By Appointment",
  },
} as const;

/** Legal and SMS program details used on privacy, terms, and the quote opt-in. */
export const LEGAL = {
  entityName: "Sublime Design NV LLC",
  programName: "Sublime Design NV",
  email: SITE.email,
  emailHref: SITE.emailHref,
  street: "5747 Garriga St",
  cityStateZip: "Las Vegas, NV 89135",
  address: "5747 Garriga St, Las Vegas, NV 89135",
  smsPhoneDisplay: "(702) 241-6907",
  smsPhoneHref: "sms:+17022416907",
  effectiveDate: "September 30, 2026",
  smsNoShareStatement:
    "We do not share, sell, or rent mobile phone numbers, SMS opt-in data, or consent with third parties or affiliates for marketing or promotional purposes. Mobile information will not be shared with third parties/affiliates for marketing/promotional purposes; text messaging originator opt-in data and consent will not be shared with any third parties.",
} as const;

export const SERVICES = [
  {
    slug: "barn-doors",
    title: "Custom Barn Doors",
    shortTitle: "Barn Doors",
    description:
      "Built to fit your opening and style, with hardware selected for smooth daily use. We handle measurement, fabrication, finishing, and installation.",
  },
  {
    slug: "cabinets",
    title: "Custom Cabinets",
    shortTitle: "Cabinets",
    description:
      "Cabinet solutions designed around your layout, storage needs, and material preferences. Each install is measured and finished for long-term durability.",
  },
  {
    slug: "closets",
    title: "Custom Closets",
    shortTitle: "Closets",
    description:
      "Functional closet systems with shelving, hanging space, and drawer options sized to your room. We focus on practical organization and clean installation.",
  },
  {
    slug: "faux-beams",
    title: "Faux Wood Beams",
    shortTitle: "Faux Beams",
    description:
      "Lightweight faux beams that add architectural detail without structural changes. We match stain and scale to your ceiling and existing finishes.",
  },
  {
    slug: "floating-shelves",
    title: "Floating Shelves",
    shortTitle: "Floating Shelves",
    description:
      "Custom floating shelves built for the span, load, and look you need. Hidden support hardware keeps the profile clean while staying stable.",
  },
  {
    slug: "mantels",
    title: "Custom Mantels",
    shortTitle: "Mantels",
    description:
      "Fireplace mantels made to fit your surround and room proportions. We offer simple and detailed profiles with paint- or stain-grade options.",
  },
  {
    slug: "trim-work",
    title: "Trim Work",
    shortTitle: "Trim Work",
    description:
      "Finish carpentry for walls, ceilings, openings, and transitions that need clean lines. Precise cuts and consistent reveals keep the final result polished.",
    subtypes: [
      "Crown Mouldings",
      "Baseboards",
      "Shiplap",
      "Wainscotting",
      "Casings",
      "Beadboard",
      "Decorative Mouldings",
    ],
  },
] as const;

export const VALUE_PROPS = [
  {
    number: "01",
    title: "Free Estimates",
    body: "No obligation quotes on every project, big or small.",
  },
  {
    number: "02",
    title: "Quality Materials",
    body: "We only source and use premium wood and hardware.",
  },
  {
    number: "03",
    title: "Superior Craftsmanship",
    body: "Over 14 years of expert carpentry in Las Vegas.",
  },
  {
    number: "04",
    title: "Local & Trusted",
    body: "Proudly serving Las Vegas and the surrounding valley since 2016.",
  },
] as const;

export const FAQ_ITEMS = [
  {
    question: "What areas do you serve?",
    answer:
      "We serve Las Vegas and the surrounding valley, including Henderson, Summerlin, North Las Vegas, and beyond.",
  },
  {
    question: "Do you offer free estimates?",
    answer: "Yes. All estimates are free and come with no obligation.",
  },
  {
    question: "How long does a typical project take?",
    answer:
      "It depends on the scope. Small trim jobs can be done in a day. Larger custom builds like cabinets or closets typically take 1–2 weeks from design approval to installation.",
  },
  {
    question: "Do you work on commercial properties?",
    answer: "Yes. We serve both residential and commercial clients.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept credit cards, electronic check, and electronic signature for contracts.",
  },
  {
    question: "How do I get started?",
    answer:
      "Fill out our quote request form or call us at (702) 241-6907. We'll respond within 24 hours.",
  },
] as const;
