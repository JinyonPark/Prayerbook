"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isKakaoInApp, isStandaloneDisplay, type BeforeInstallPromptEvent } from "@/lib/pwa/detect";
import { useVisualViewport } from "@/lib/pwa/visual-viewport";

type InstallContextValue = {
  ready: boolean;
  installed: boolean;
  canNativeInstall: boolean;
  installNative: () => Promise<"accepted" | "dismissed" | "unavailable">;
};

const InstallContext = createContext<InstallContextValue | null>(null);

export function InstallPromptProvider({ children }: { children: ReactNode }) {
  useVisualViewport();
  const [installed, setInstalled] = useState(false);
  const [ready, setReady] = useState(false);
  const [nativePrompt, setNativePrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setInstalled(Boolean(window.__prayerbookInstalled) || isStandaloneDisplay());
    if (window.__prayerbookInstallPrompt) {
      setNativePrompt(window.__prayerbookInstallPrompt);
    }

    function onPrompt(event: Event) {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      window.__prayerbookInstallPrompt = promptEvent;
      setNativePrompt(promptEvent);
    }
    function onInstalled() {
      window.__prayerbookInstallPrompt = null;
      window.__prayerbookInstalled = true;
      setNativePrompt(null);
      setInstalled(true);
    }
    function onDisplayMode(event: MediaQueryListEvent) {
      if (event.matches) setInstalled(true);
    }

    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    standaloneQuery.addEventListener("change", onDisplayMode);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    }
    setReady(true);
    return () => {
      standaloneQuery.removeEventListener("change", onDisplayMode);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const installNative = useCallback(async () => {
    if (isKakaoInApp()) return "unavailable" as const;
    const event = nativePrompt ?? window.__prayerbookInstallPrompt ?? null;
    if (!event) return "unavailable" as const;
    await event.prompt();
    const choice = await event.userChoice;
    window.__prayerbookInstallPrompt = null;
    setNativePrompt(null);
    if (choice.outcome === "accepted") {
      setInstalled(true);
    }
    return choice.outcome;
  }, [nativePrompt]);

  const value = useMemo(
    () => ({
      ready,
      installed,
      canNativeInstall: Boolean(nativePrompt) && !isKakaoInApp(),
      installNative,
    }),
    [ready, installed, nativePrompt, installNative],
  );

  return <InstallContext.Provider value={value}>{children}</InstallContext.Provider>;
}

export function useInstallPrompt() {
  const value = useContext(InstallContext);
  if (!value) {
    return {
      ready: false,
      installed: false,
      canNativeInstall: false,
      installNative: async () => "unavailable" as const,
    };
  }
  return value;
}
