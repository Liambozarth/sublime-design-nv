import type { MetadataRoute } from "next";
import { getBusinessSettings } from "@/lib/settings";

// Served at /manifest.webmanifest; Next injects <link rel="manifest"> automatically.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getBusinessSettings();

  return {
    name: "Sublime Design NV",
    short_name: "Sublime Design",
    description: settings.tagline ?? "Custom Woodwork. Elevated.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: "#1B2A6B",
    background_color: "#FFFFFF",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
