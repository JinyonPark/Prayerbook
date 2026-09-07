"use client";

import { useEffect } from "react";

export function readVisualViewport() {
  const viewport = typeof window === "undefined" ? null : window.visualViewport;
  return {
    offsetTop: viewport?.offsetTop ?? 0,
    height: viewport?.height ?? (typeof window === "undefined" ? 0 : window.innerHeight),
    width: viewport?.width ?? (typeof window === "undefined" ? 0 : window.innerWidth),
  };
}

export function applyVisualViewportProperties() {
  if (typeof document === "undefined") return readVisualViewport();
  const next = readVisualViewport();
  const root = document.documentElement;
  root.style.setProperty("--visual-viewport-top", `${next.offsetTop}px`);
  root.style.setProperty("--visual-viewport-height", `${next.height}px`);
  root.style.setProperty("--visual-viewport-width", `${next.width}px`);
  return next;
}

export function useVisualViewport() {
  useEffect(() => {
    applyVisualViewportProperties();
    const viewport = window.visualViewport;
    function onChange() {
      applyVisualViewportProperties();
    }
    viewport?.addEventListener("resize", onChange);
    viewport?.addEventListener("scroll", onChange);
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      viewport?.removeEventListener("resize", onChange);
      viewport?.removeEventListener("scroll", onChange);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, []);
}

export function lockBodyScroll() {
  const scrollY = window.scrollY;
  const previous = document.body.style.cssText;
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
  document.body.style.overflow = "hidden";
  return () => {
    document.body.style.cssText = previous;
    window.scrollTo(0, scrollY);
  };
}
