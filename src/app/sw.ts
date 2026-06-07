import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // ── NEVER cache admin or API. Admin must always be live; sessions never cached. ──
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin && (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin/")),
      handler: new NetworkOnly(),
    },
    // ── Icons / static (cache-first) ──
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/icons/"),
      handler: new CacheFirst({ cacheName: "static-icons" }),
    },
    // ── Cloudinary images (stale-while-revalidate, capped) ──
    {
      matcher: ({ url }) => url.hostname === "res.cloudinary.com",
      handler: new StaleWhileRevalidate({
        cacheName: "cloudinary-images",
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    // ── Everything else: Next-optimized defaults (static assets cache-first, pages
    //    network-first, RSC handling). Public pages fall back to /offline below. ──
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
