"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function subscribeToNetwork(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getNetworkSnapshot() {
  return navigator.onLine;
}

function getNetworkServerSnapshot() {
  return true;
}

function subscribeToStandalone(callback: () => void) {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", callback);
  window.addEventListener("appinstalled", callback);
  return () => {
    media.removeEventListener("change", callback);
    window.removeEventListener("appinstalled", callback);
  };
}

function getStandaloneSnapshot() {
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function getStandaloneServerSnapshot() {
  return false;
}

export function usePWA() {
  const installPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const isOnline = useSyncExternalStore(subscribeToNetwork, getNetworkSnapshot, getNetworkServerSnapshot);
  const isStandalone = useSyncExternalStore(subscribeToStandalone, getStandaloneSnapshot, getStandaloneServerSnapshot);
  const [canInstall, setCanInstall] = useState(false);
  const [installedByPrompt, setInstalledByPrompt] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const isInstalled = isStandalone || installedByPrompt;

  useEffect(() => {
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      installPrompt.current = event as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    const installed = () => {
      installPrompt.current = null;
      setCanInstall(false);
      setInstalledByPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" })
        .then(() => navigator.serviceWorker.ready)
        .then(() => setOfflineReady(true))
        .catch(() => setOfflineReady(false));
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const install = useCallback(async () => {
    const prompt = installPrompt.current;
    if (!prompt) return false;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") {
      installPrompt.current = null;
      setCanInstall(false);
      return true;
    }
    return false;
  }, []);

  return { canInstall, install, isInstalled, isOnline, offlineReady };
}
