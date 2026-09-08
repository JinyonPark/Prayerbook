"use client";

import type { MouseEvent, ReactNode } from "react";
import { hardNavigate } from "@/lib/prayers/navigate";

type Props = {
  href: string;
  className?: string;
  children: ReactNode;
  onNavigate?: () => void | false;
};

export function ReaderNavLink({ href, className, children, onNavigate }: Props) {
  return (
    <a
      href={href}
      className={className}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (onNavigate?.() === false) return;
        hardNavigate(href);
      }}
    >
      {children}
    </a>
  );
}
