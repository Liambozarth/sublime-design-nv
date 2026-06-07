"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallAppButton({ onNavigate }: { onNavigate?: () => void }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const standaloneNow =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setStandalone(standaloneNow);

    const ua = window.navigator.userAgent;
    // iOS Safari (not Chrome/Firefox on iOS) — no beforeinstallprompt event there.
    setIsIos(/iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setStandalone(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Hide entirely when already installed, or when neither install path is available.
  if (standalone) return null;
  if (!deferred && !isIos) return null;

  async function handleClick() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice.catch(() => null);
      setDeferred(null);
      onNavigate?.();
    } else {
      setShowIosHelp(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-ui text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
      >
        <Download className="h-4 w-4 flex-shrink-0 text-gray-400" />
        <span>Install app</span>
      </button>

      {showIosHelp && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowIosHelp(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h3 className="text-lg text-charcoal">Add to Home Screen</h3>
              <button type="button" onClick={() => setShowIosHelp(false)} className="text-gray-400 hover:text-gray-700" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 font-ui text-sm text-gray-mid">
              To install Sublime Design on your iPhone or iPad:
            </p>
            <ol className="mt-3 space-y-2 font-ui text-sm text-charcoal">
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-navy/10 text-xs font-bold text-navy">1</span>
                Tap the <Share className="inline h-4 w-4" /> Share button in Safari
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-navy/10 text-xs font-bold text-navy">2</span>
                Scroll down and tap &ldquo;Add to Home Screen&rdquo;
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-navy/10 text-xs font-bold text-navy">3</span>
                Tap &ldquo;Add&rdquo; — the app icon appears on your home screen
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
