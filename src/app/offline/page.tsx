import Image from "next/image";

export const metadata = { title: "Offline" };

// Branded offline fallback served by the service worker when a navigation fails.
export default function OfflinePage() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center bg-cream px-6 text-center">
      <Image
        src="/icons/icon-192.png"
        alt="Sublime Design NV"
        width={96}
        height={96}
        className="rounded-2xl border border-gray-200 shadow-sm"
      />
      <h1 className="mt-6 text-3xl text-charcoal">You&apos;re offline</h1>
      <p className="mt-3 max-w-sm font-ui text-sm text-gray-mid">
        Reconnect to view the latest. Pages you&apos;ve already visited may still be available.
      </p>
      <a
        href="/"
        className="mt-6 rounded-lg bg-navy px-5 py-2.5 font-ui text-sm font-semibold text-white"
      >
        Try again
      </a>
    </main>
  );
}
