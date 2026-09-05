"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

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
  const [listHeight, setListHeight] = useState(360);

  useEffect(() => {
    if (!open) return;

    function measure() {
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      const header = headerRef.current?.offsetHeight ?? 72;
      const sheet = Math.round(viewport * 0.9);
      setListHeight(Math.max(200, sheet - header));
    }

    lastFocus.current = document.activeElement as HTMLElement | null;
    const scrollY = window.scrollY;
    const previous = document.body.style.cssText;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";

    measure();
    const frame = window.requestAnimationFrame(measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.addEventListener("resize", measure);

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);

    return () => {
      window.cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener("resize", measure);
      window.removeEventListener("resize", measure);
      document.removeEventListener("keydown", onKey);
      document.body.style.cssText = previous;
      window.scrollTo(0, scrollY);
      lastFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col lg:hidden" style={{ height: "100dvh" }}>
      <button
        type="button"
        aria-label="목차 닫기"
        className="min-h-0 flex-1 bg-[var(--overlay)]"
        onClick={onClose}
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
          onTouchMove={(event) => event.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
