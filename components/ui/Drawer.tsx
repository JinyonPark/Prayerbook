"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { lockBodyScroll, useVisualViewport } from "@/lib/pwa/visual-viewport";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Drawer({ open, title, onClose, children }: Props) {
  const headingId = useId();
  const headerRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [listHeight, setListHeight] = useState(360);
  useVisualViewport();

  useEffect(() => {
    if (!open) return;

    function measure() {
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      const header = headerRef.current?.offsetHeight ?? 72;
      const sheet = Math.round(viewport * 0.9);
      setListHeight(Math.max(200, sheet - header));
    }

    lastFocus.current = document.activeElement as HTMLElement | null;
    const unlock = lockBodyScroll();
    measure();
    const frame = window.requestAnimationFrame(measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.addEventListener("resize", measure);

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);

    return () => {
      window.cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener("resize", measure);
      window.removeEventListener("resize", measure);
      document.removeEventListener("keydown", onKey);
      unlock();
      lastFocus.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed z-[80] flex flex-col lg:hidden"
      style={{
        top: "var(--visual-viewport-top, 0px)",
        height: "var(--visual-viewport-height, 100dvh)",
        left: 0,
        right: 0,
      }}
    >
      <button
        type="button"
        aria-label="목차 닫기"
        className="min-h-0 flex-1 bg-[var(--overlay)]"
        onClick={() => onCloseRef.current()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative z-10 flex w-full flex-col rounded-t-2xl bg-[var(--card)]"
      >
        <div ref={headerRef} className="shrink-0 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border)]" />
          <h2 id={headingId} className="px-4 pb-3 text-lg font-semibold">
            {title}
          </h2>
        </div>
        <div
          className="drawer-scroll px-4 pb-[calc(1rem+var(--safe-bottom))]"
          style={{
            height: listHeight,
            overflowY: "scroll",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
            overscrollBehavior: "contain",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
