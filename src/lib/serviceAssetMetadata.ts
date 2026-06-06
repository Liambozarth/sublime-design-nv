import { findService, type CanonicalServiceSlug } from "@/content/services";

export type ServiceMetadataFieldType = "select" | "boolean" | "number" | "text";

export type ServiceMetadataFieldOption = {
  value: string;
  label: string;
};

export type ServiceMetadataField = {
  key: string;
  label: string;
  type: ServiceMetadataFieldType;
  options?: ServiceMetadataFieldOption[];
  placeholder?: string;
  required?: boolean;
  min?: number;
  step?: number;
  showWhen?: {
    field: string;
    equals: string | boolean;
  };
};

export type ServiceMetadataConfig = {
  service: CanonicalServiceSlug;
  label: string;
  fields: ServiceMetadataField[];
};

type ValidationSuccess = {
  ok: true;
  data: Record<string, string | number | boolean>;
};

type ValidationFailure = {
  ok: false;
  errors: string[];
};

export type ServiceMetadataValidationResult = ValidationSuccess | ValidationFailure;

export const SERVICE_ASSET_METADATA_CONFIG: Record<
  CanonicalServiceSlug,
  ServiceMetadataConfig
> = {
  "barn-doors": {
    service: "barn-doors",
    label: "Barn Doors",
    fields: [
      {
        key: "doorCount",
        label: "Door Count",
        type: "select",
        options: [
          { value: "1", label: "1" },
          { value: "2", label: "2" },
          { value: "3", label: "3" },
          { value: "4", label: "4" },
          { value: "custom", label: "Custom" },
        ],
      },
      {
        key: "doorStyle",
        label: "Style",
        type: "select",
        options: [
          { value: "sliding", label: "Sliding" },
          { value: "bypass", label: "Bypass" },
          { value: "bi-fold", label: "Bi-fold" },
          { value: "french", label: "French" },
          { value: "pocket", label: "Pocket" },
          { value: "other", label: "Other" },
        ],
      },
      {
        key: "doorStyleOther",
        label: "Style Details",
        type: "text",
        placeholder: "Custom slab, arched panel, etc.",
        showWhen: { field: "doorStyle", equals: "other" },
      },
      {
        key: "hardwareColor",
        label: "Hardware Color",
        type: "select",
        options: [
          { value: "matte-black", label: "Matte Black" },
          { value: "brushed-nickel", label: "Brushed Nickel" },
          { value: "oil-rubbed-bronze", label: "Oil Rubbed Bronze" },
          { value: "chrome", label: "Chrome" },
          { value: "gold", label: "Gold" },
          { value: "white", label: "White" },
          { value: "other", label: "Other" },
        ],
      },
      {
        key: "hardwareColorOther",
        label: "Hardware Color Details",
        type: "text",
        placeholder: "Matte brass, antique copper, etc.",
        showWhen: { field: "hardwareColor", equals: "other" },
      },
      { key: "customSize", label: "Custom Size", type: "boolean" },
      { key: "softClose", label: "Soft Close Hardware", type: "boolean" },
      { key: "installIncluded", label: "Install Included", type: "boolean" },
    ],
  },
  "floating-shelves": {
    service: "floating-shelves",
    label: "Floating Shelves",
    fields: [
      {
        key: "shelfCount",
        label: "Shelf Count",
        type: "number",
        min: 1,
        step: 1,
        placeholder: "e.g. 4",
      },
      {
        key: "bracketType",
        label: "Bracket Type",
        type: "select",
        options: [
          { value: "standard", label: "Standard" },
          { value: "heavy-duty", label: "Heavy Duty" },
          { value: "invisible", label: "Invisible" },
          { value: "rod-pipe", label: "Rod & Pipe" },
          { value: "other", label: "Other" },
        ],
      },
      {
        key: "lighting",
        label: "Lighting",
        type: "select",
        options: [
          { value: "none", label: "None" },
          { value: "led-tape", label: "LED Tape" },
          { value: "puck-lights", label: "Puck Lights" },
          { value: "strip-lights", label: "Strip Lights" },
          { value: "other", label: "Other" },
        ],
      },
      { key: "transformerIncluded", label: "Transformer Included", type: "boolean" },
      { key: "installIncluded", label: "Install Included", type: "boolean" },
    ],
  },
  mantels: {
    service: "mantels",
    label: "Mantels",
    fields: [
      {
        key: "mantelWidth",
        label: "Mantel Width (inches)",
        type: "number",
        min: 1,
        step: 1,
        placeholder: "e.g. 72",
      },
      {
        key: "mantelStyle",
        label: "Mantel Style",
        type: "select",
        options: [
          { value: "traditional", label: "Traditional" },
          { value: "modern", label: "Modern" },
          { value: "rustic", label: "Rustic" },
          { value: "craftsman", label: "Craftsman" },
          { value: "floating", label: "Floating" },
          { value: "other", label: "Other" },
        ],
      },
      {
        key: "surround",
        label: "Surround",
        type: "select",
        options: [
          { value: "none", label: "None" },
          { value: "full-surround", label: "Full Surround" },
          { value: "partial", label: "Partial" },
          { value: "other", label: "Other" },
        ],
      },
      { key: "hiddenStorage", label: "Hidden Storage", type: "boolean" },
      { key: "installIncluded", label: "Install Included", type: "boolean" },
    ],
  },
  "media-walls": {
    service: "media-walls",
    label: "Media Walls",
    fields: [
      {
        key: "tvSize",
        label: "TV Size (inches)",
        type: "number",
        min: 1,
        step: 1,
        placeholder: "e.g. 65",
      },
      {
        key: "mountType",
        label: "Mount Type",
        type: "select",
        options: [
          { value: "fixed", label: "Fixed" },
          { value: "tilting", label: "Tilting" },
          { value: "full-motion", label: "Full Motion" },
          { value: "recessed", label: "Recessed" },
          { value: "other", label: "Other" },
        ],
      },
      {
        key: "cabinetCount",
        label: "Cabinet Count",
        type: "number",
        min: 0,
        step: 1,
        placeholder: "e.g. 4",
      },
      { key: "cableManagement", label: "Cable Management", type: "boolean" },
      { key: "ledLighting", label: "LED Lighting", type: "boolean" },
      { key: "fireplaceIntegrated", label: "Fireplace Integrated", type: "boolean" },
      { key: "installIncluded", label: "Install Included", type: "boolean" },
    ],
  },
  "faux-beams": {
    service: "faux-beams",
    label: "Faux Beams",
    fields: [
      {
        key: "beamCount",
        label: "Beam Count",
        type: "number",
        min: 1,
        step: 1,
        placeholder: "e.g. 6",
      },
      {
        key: "beamStyle",
        label: "Beam Style",
        type: "select",
        options: [
          { value: "box-beam", label: "Box Beam" },
          { value: "solid-beam", label: "Solid Beam" },
          { value: "rough-hewn", label: "Rough Hewn" },
          { value: "smooth", label: "Smooth" },
          { value: "reclaimed-look", label: "Reclaimed Look" },
          { value: "other", label: "Other" },
        ],
      },
      {
        key: "beamOrientation",
        label: "Orientation",
        type: "select",
        options: [
          { value: "ceiling", label: "Ceiling" },
          { value: "wall", label: "Wall" },
          { value: "both", label: "Both" },
          { value: "tray-ceiling", label: "Tray Ceiling" },
          { value: "other", label: "Other" },
        ],
      },
      {
        key: "beamStraps",
        label: "Beam Straps",
        type: "select",
        options: [
          { value: "none", label: "None" },
          { value: "decorative-straps", label: "Decorative Straps" },
        ],
      },
      { key: "customSize", label: "Custom Size", type: "boolean" },
      { key: "installIncluded", label: "Install Included", type: "boolean" },
    ],
  },
  cabinets: {
    service: "cabinets",
    label: "Cabinets",
    fields: [
      {
        key: "cabinetCount",
        label: "Cabinet Count",
        type: "number",
        min: 1,
        step: 1,
        placeholder: "e.g. 12",
      },
      {
        key: "doorStyle",
        label: "Door Style",
        type: "select",
        options: [
          { value: "shaker", label: "Shaker" },
          { value: "flat-panel", label: "Flat Panel" },
          { value: "raised-panel", label: "Raised Panel" },
          { value: "slab", label: "Slab" },
          { value: "beadboard", label: "Beadboard" },
          { value: "glass-front", label: "Glass Front" },
          { value: "open", label: "Open" },
          { value: "other", label: "Other" },
        ],
      },
      {
        key: "boxConstruction",
        label: "Box Construction",
        type: "select",
        options: [
          { value: "frameless", label: "Frameless" },
          { value: "face-frame", label: "Face Frame" },
          { value: "inset", label: "Inset" },
          { value: "other", label: "Other" },
        ],
      },
      { key: "softClose", label: "Soft Close Hinges", type: "boolean" },
      { key: "fullExtension", label: "Full Extension Drawers", type: "boolean" },
      { key: "pullouts", label: "Pull-Out Shelves", type: "boolean" },
      { key: "installIncluded", label: "Install Included", type: "boolean" },
    ],
  },
  "custom-closets": {
    service: "custom-closets",
    label: "Custom Closets",
    fields: [
      {
        key: "closetType",
        label: "Closet Type",
        type: "select",
        options: [
          { value: "walk-in", label: "Walk-In" },
          { value: "reach-in", label: "Reach-In" },
          { value: "wardrobe", label: "Wardrobe" },
          { value: "other", label: "Other" },
        ],
      },
      {
        key: "hangingSections",
        label: "Hanging Sections",
        type: "number",
        min: 0,
        step: 1,
        placeholder: "e.g. 4",
      },
      { key: "shoeShelving", label: "Shoe Shelving", type: "boolean" },
      { key: "glassFrontUppers", label: "Glass Front Uppers", type: "boolean" },
      { key: "vanityTower", label: "Vanity Tower", type: "boolean" },
      { key: "islandOrBench", label: "Island or Bench", type: "boolean" },
      {
        key: "drawerCount",
        label: "Drawer Count",
        type: "number",
        min: 0,
        step: 1,
        placeholder: "e.g. 6",
      },
      {
        key: "materialColor",
        label: "Material Color",
        type: "text",
        placeholder: "e.g. textured greige TFL",
      },
      { key: "installIncluded", label: "Install Included", type: "boolean" },
    ],
  },
  "feature-wall": {
    service: "feature-wall",
    label: "Feature Walls",
    fields: [
      {
        key: "wallWidth",
        label: "Wall Width (feet)",
        type: "number",
        min: 1,
        step: 0.5,
        placeholder: "e.g. 14",
      },
      {
        key: "panelStyle",
        label: "Panel Style",
        type: "select",
        options: [
          { value: "shiplap", label: "Shiplap" },
          { value: "board-and-batten", label: "Board & Batten" },
          { value: "slat-wall", label: "Slat Wall" },
          { value: "geometric", label: "Geometric" },
          { value: "herringbone", label: "Herringbone" },
          { value: "fluted", label: "Fluted" },
          { value: "vertical-shiplap", label: "Vertical Shiplap" },
          { value: "panel-detail", label: "Panel Detail" },
          { value: "other", label: "Other" },
        ],
      },
      {
        key: "layout",
        label: "Layout",
        type: "select",
        options: [
          { value: "vertical", label: "Vertical" },
          { value: "horizontal", label: "Horizontal" },
          { value: "diagonal", label: "Diagonal" },
          { value: "mixed", label: "Mixed" },
          { value: "other", label: "Other" },
        ],
      },
      { key: "ledLighting", label: "LED Lighting", type: "boolean" },
      { key: "installIncluded", label: "Install Included", type: "boolean" },
    ],
  },
  "led-lighting": {
    service: "led-lighting",
    label: "LED Lighting",
    fields: [
      {
        key: "stripLength",
        label: "Strip Length (feet)",
        type: "number",
        min: 1,
        step: 1,
        placeholder: "e.g. 24",
      },
      {
        key: "lightingType",
        label: "Lighting Type",
        type: "select",
        options: [
          { value: "led-tape", label: "LED Tape" },
          { value: "puck-lights", label: "Puck Lights" },
          { value: "strip-lights", label: "Strip Lights" },
          { value: "both", label: "Both" },
          { value: "other", label: "Other" },
        ],
      },
      {
        key: "controllerType",
        label: "Controller Type",
        type: "select",
        options: [
          { value: "switch", label: "Switch" },
          { value: "dimmer", label: "Dimmer" },
          { value: "smart-app", label: "Smart/App" },
          { value: "remote", label: "Remote" },
          { value: "none", label: "No Controller" },
          { value: "other", label: "Other" },
        ],
      },
      {
        key: "colorTemp",
        label: "Color Temperature",
        type: "select",
        options: [
          { value: "2700k", label: "Warm White (2700K)" },
          { value: "3000k", label: "Neutral White (3000K)" },
          { value: "4000k", label: "Cool White (4000K)" },
          { value: "5000k", label: "Daylight (5000K)" },
          { value: "rgb", label: "RGB" },
          { value: "rgbw", label: "RGBW" },
          { value: "tunable", label: "Tunable" },
        ],
      },
      {
        key: "millworkContext",
        label: "Millwork Context",
        type: "select",
        options: [
          { value: "shelves", label: "Shelves" },
          { value: "cabinets", label: "Cabinets" },
          { value: "beams", label: "Faux Beams" },
          { value: "feature-wall", label: "Feature Wall" },
          { value: "other", label: "Other" },
        ],
      },
      { key: "transformerIncluded", label: "Transformer Included", type: "boolean" },
      { key: "installIncluded", label: "Install Included", type: "boolean" },
    ],
  },
  trim: {
    service: "trim",
    label: "Trim & Finish",
    fields: [
      {
        key: "linearFeet",
        label: "Linear Feet",
        type: "number",
        min: 1,
        step: 1,
        placeholder: "e.g. 120",
      },
      {
        key: "trimType",
        label: "Trim Type",
        type: "select",
        options: [
          { value: "baseboard", label: "Baseboard" },
          { value: "crown", label: "Crown Molding" },
          { value: "door-casing", label: "Door Casing" },
          { value: "window-casing", label: "Window Casing" },
          { value: "chair-rail", label: "Chair Rail" },
          { value: "wainscoting", label: "Wainscoting" },
          { value: "picture-frame", label: "Picture Frame" },
          { value: "board-and-batten", label: "Board and Batten" },
          { value: "shiplap", label: "Shiplap" },
          { value: "other", label: "Other" },
        ],
      },
      {
        key: "profileStyle",
        label: "Profile Style",
        type: "select",
        options: [
          { value: "colonial", label: "Colonial" },
          { value: "craftsman", label: "Craftsman" },
          { value: "modern", label: "Modern" },
          { value: "victorian", label: "Victorian" },
          { value: "ranch", label: "Ranch" },
          { value: "other", label: "Other" },
        ],
      },
      { key: "paintedFinish", label: "Painted Finish", type: "boolean" },
      { key: "installIncluded", label: "Install Included", type: "boolean" },
    ],
  },
};

export function getServiceAssetMetadataConfig(service: string) {
  return SERVICE_ASSET_METADATA_CONFIG[service as CanonicalServiceSlug] ?? null;
}

export function getVisibleServiceMetadataFields(
  service: string,
  values: Record<string, unknown>,
) {
  const config = getServiceAssetMetadataConfig(service);
  if (!config) return [];

  return config.fields.filter((field) => {
    if (!field.showWhen) return true;
    return values[field.showWhen.field] === field.showWhen.equals;
  });
}

export function sanitizeServiceAssetMetadata(
  service: string,
  rawValues: Record<string, unknown>,
) {
  const visibleFields = getVisibleServiceMetadataFields(service, rawValues);
  const allowedKeys = new Set(visibleFields.map((field) => field.key));

  return Object.fromEntries(
    Object.entries(rawValues).filter(([key]) => allowedKeys.has(key)),
  );
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function validateServiceAssetMetadata(
  service: string,
  rawValues: unknown,
): ServiceMetadataValidationResult {
  const config = getServiceAssetMetadataConfig(service);
  if (!config) {
    return { ok: false, errors: ["Invalid primary service."] };
  }

  const values =
    rawValues && typeof rawValues === "object" && !Array.isArray(rawValues)
      ? (rawValues as Record<string, unknown>)
      : {};

  const visibleFields = getVisibleServiceMetadataFields(service, values);
  const allowedKeys = new Set(visibleFields.map((field) => field.key));
  const unknownKeys = Object.keys(values).filter((key) => !allowedKeys.has(key));

  if (unknownKeys.length > 0) {
    return {
      ok: false,
      errors: [`Invalid metadata keys for ${config.label}: ${unknownKeys.join(", ")}`],
    };
  }

  const data: Record<string, string | number | boolean> = {};
  const errors: string[] = [];

  for (const field of visibleFields) {
    const value = values[field.key];

    if (value === undefined || value === null || value === "") {
      if (field.required) errors.push(`${field.label} is required.`);
      continue;
    }

    if (field.type === "text") {
      if (typeof value !== "string") {
        errors.push(`${field.label} must be text.`);
        continue;
      }
      const trimmed = value.trim();
      if (!trimmed) {
        if (field.required) errors.push(`${field.label} is required.`);
        continue;
      }
      data[field.key] = trimmed;
      continue;
    }

    if (field.type === "select") {
      if (typeof value !== "string") {
        errors.push(`${field.label} must be a string.`);
        continue;
      }
      const validOptions = field.options?.map((option) => option.value) ?? [];
      if (!validOptions.includes(value)) {
        errors.push(`${field.label} has an invalid value.`);
        continue;
      }
      data[field.key] = value;
      continue;
    }

    if (field.type === "boolean") {
      const parsed = parseBoolean(value);
      if (parsed === null) {
        errors.push(`${field.label} must be yes or no.`);
        continue;
      }
      data[field.key] = parsed;
      continue;
    }

    if (field.type === "number") {
      const parsed = parseNumber(value);
      if (parsed === null) {
        errors.push(`${field.label} must be a number.`);
        continue;
      }
      if (typeof field.min === "number" && parsed < field.min) {
        errors.push(`${field.label} must be at least ${field.min}.`);
        continue;
      }
      data[field.key] = parsed;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data };
}

export function buildAssetAltText(input: {
  title: string;
  location?: string | null;
  primaryServiceSlug: string;
}) {
  const service = findService(input.primaryServiceSlug);
  const serviceLabel = service?.shortTitle ?? input.primaryServiceSlug.replace(/-/g, " ");
  const location = input.location?.trim();

  return location
    ? `${input.title} - ${serviceLabel} in ${location}`
    : `${input.title} - ${serviceLabel}`;
}
