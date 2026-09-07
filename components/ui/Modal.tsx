"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { lockBodyScroll, useVisualViewport } from "@/lib/pwa/visual-viewport";
import { isKakaoInApp } from "@/lib/pwa/detect";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  closeDisabled?: boolean;
  variant?: "auto" | "center" | "sheet";
  descriptionId?: string;
};

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  closeDisabled = false,
  variant = "auto",
  descriptionId,
}: Props) {
  const headingId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useVisualViewport();
  const sheet = variant === "sheet" || (variant === "auto" && typeof navigator !== "undefined" && isKakaoInApp());

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
    const unlock = lockBodyScroll();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !closeDisabled) {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const nodes = [...dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      )];
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      unlock();
      lastFocus.current?.focus();
    };
  }, [open, closeDisabled]);

  if (!open) return null;

  return (
    <div
      className="fixed z-[80] flex justify-center"
      role="presentation"
      style={{
        top: "var(--visual-viewport-top, 0px)",
        height: "var(--visual-viewport-height, 100dvh)",
        left: 0,
        right: 0,
        paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))",
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
        paddingLeft: "0.75rem",
        paddingRight: "0.75rem",
        alignItems: sheet ? "flex-end" : "center",
      }}
    >
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-[var(--overlay)]"
        onClick={() => {
          if (!closeDisabled) onClose();
        }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        {...(descriptionId ? { "aria-describedby": descriptionId } : {})}
        className={`relative z-10 flex w-full max-w-lg flex-col overflow-hidden border border-[var(--border)] bg-[var(--card)] shadow-lg ${
          sheet ? "rounded-t-2xl" : "rounded-2xl"
        }`}
        style={{ maxHeight: "calc(var(--visual-viewport-height, 100dvh) - 1.5rem)" }}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-[var(--border)] px-5 py-3">
          <h2 id={headingId} className="min-w-0 flex-1 text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            className="touch-target shrink-0 rounded-xl px-2 text-sm"
            onClick={() => {
              if (!closeDisabled) onClose();
            }}
            disabled={closeDisabled}
          >
            닫기
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3">{children}</div>
        {footer ? <div className="shrink-0 border-t border-[var(--border)] px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}
