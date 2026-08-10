"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { detectInstallPlatform, type InstallPlatform } from "@/features/pwa-platform";

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

function subscribeToPlatform() {
  return () => undefined;
}

function getPlatformSnapshot(): InstallPlatform {
  return detectInstallPlatform({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}

function getPlatformServerSnapshot(): InstallPlatform {
  return "unknown";
}

export function usePWA() {
  const installPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const isOnline = useSyncExternalStore(subscribeToNetwork, getNetworkSnapshot, getNetworkServerSnapshot);
  const isStandalone = useSyncExternalStore(subscribeToStandalone, getStandaloneSnapshot, getStandaloneServerSnapshot);
  const [canInstall, setCanInstall] = useState(false);
  const [installedByPrompt, setInstalledByPrompt] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const platform = useSyncExternalStore(subscribeToPlatform, getPlatformSnapshot, getPlatformServerSnapshot);
  const isInstalled = isStandalone || installedByPrompt;

  useEffect(() => {
    let removeControllerListener: (() => void) | undefined;
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

    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        const controlledAtStart = Boolean(navigator.serviceWorker.controller);
        let refreshing = false;
        const refreshOnUpdate = () => {
          if (!controlledAtStart || refreshing) return;
          refreshing = true;
          window.location.reload();
        };
        navigator.serviceWorker.addEventListener("controllerchange", refreshOnUpdate);
        removeControllerListener = () => navigator.serviceWorker.removeEventListener("controllerchange", refreshOnUpdate);
        navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
          .then(async (registration) => {
            await registration.update();
            await navigator.serviceWorker.ready;
            setOfflineReady(true);
          })
          .catch(() => setOfflineReady(false));
      } else {
        // A production worker previously installed on localhost must never cache
        // development chunks: their URLs can stay stable while their code changes.
        const controlledByOldWorker = Boolean(navigator.serviceWorker.controller);
        void navigator.serviceWorker.getRegistrations()
          .then((registrations) => Promise.all(registrations
            .filter((registration) => registration.scope.startsWith(window.location.origin))
            .map((registration) => registration.unregister())))
          .then(() => caches.keys())
          .then((keys) => Promise.all(keys.filter((key) => key.startsWith("bibata-shell-")).map((key) => caches.delete(key))))
          .then(() => {
            if (controlledByOldWorker) window.location.reload();
          });
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
      removeControllerListener?.();
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

  const canSuggestInstall = !isInstalled && (canInstall || platform === "ios");
  return { canInstall, canSuggestInstall, install, isInstalled, isOnline, offlineReady, platform };
}
