"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __mbDeferredInstallPrompt?: any;
  }
}

export default function WhatsAppPwaRegistrar() {
  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      window.__mbDeferredInstallPrompt = e;
      window.dispatchEvent(new CustomEvent("mb-pwa-prompt-ready"));
    };

    const onInstalled = () => {
      window.__mbDeferredInstallPrompt = null;
      window.dispatchEvent(new CustomEvent("mb-pwa-installed"));
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/whatsapp" })
        .catch((err) => console.warn("[PWA SW] registration skipped:", err));
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return null;
}
