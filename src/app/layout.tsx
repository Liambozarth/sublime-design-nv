import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Montserrat, Raleway } from "next/font/google";
import { headers } from "next/headers";
import Script from "next/script";
import Navbar from "@/components/layout/Navbar";
import BuildDebugBadge from "@/components/layout/BuildDebugBadge";
import Footer from "@/components/layout/Footer";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import { auth, isAllowedAdminEmail } from "@/lib/auth";
import "./globals.css";

const displayFont = Bebas_Neue({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const bodyFont = Raleway({
  variable: "--font-body",
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  display: "swap",
});

const uiFont = Montserrat({
  variable: "--font-ui",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://sublimedesignnv.com";

export const metadata: Metadata = {
  title: {
    default: "Sublime Design NV | Custom Woodwork Las Vegas",
    template: "%s | Sublime Design NV",
  },
  description:
    "Floating shelves, media walls, faux beams, barn doors, mantels, cabinets, and trim work — measured, shop-built, and installed throughout Las Vegas Valley.",
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  openGraph: {
    siteName: "Sublime Design NV",
    locale: "en_US",
    type: "website",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Sublime Design",
    statusBarStyle: "default",
  },
  other: {
    "p:domain_verify": "6bb7e896f2f0dfde101cf90838313550",
  },
};

export const viewport: Viewport = {
  themeColor: "#1B2A6B",
};

const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const isStandalone = headersList.get("x-standalone") === "1";

  const session = await auth();
  const isAdmin = Boolean(session?.user?.email && isAllowedAdminEmail(session.user.email));

  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} ${uiFont.variable}`}
    >
      <body className="antialiased">
        {gaMeasurementId && <GoogleAnalytics measurementId={gaMeasurementId} />}
        {!isStandalone && <Navbar isAdmin={isAdmin} />}
        {children}
        {!isStandalone && <BuildDebugBadge />}
        {!isStandalone && <Footer />}
        <Script src="https://upload-widget.cloudinary.com/global/all.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
