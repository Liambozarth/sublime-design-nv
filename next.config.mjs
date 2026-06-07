import withSerwistInit from "@serwist/next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/admin/uploads", destination: "/admin/photos", permanent: true },
      { source: "/admin/photos/unlinked", destination: "/admin/photos", permanent: true },
      { source: "/admin/upload-batches", destination: "/admin/photos", permanent: true },
    ];
  },
  experimental: {
    serverComponentsExternalPackages: ["pg", "@prisma/adapter-pg"],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        pg: false,
        "@prisma/adapter-pg": false,
      };
    }
    return config;
  },
  env: {
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME:
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ??
      process.env.CLOUDINARY_CLOUD_NAME,
    NEXT_PUBLIC_BUILD_SHA:
      process.env.NEXT_PUBLIC_BUILD_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA,
    NEXT_PUBLIC_BUILD_ENV:
      process.env.NEXT_PUBLIC_BUILD_ENV ??
      process.env.VERCEL_ENV ??
      (process.env.NODE_ENV === "production" ? "production" : "local"),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

// Service worker (PWA). Registered in production only; disabled in dev.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  // /api/* and /admin/* are forced NetworkOnly inside sw.ts.
});

export default withSerwist(nextConfig);
