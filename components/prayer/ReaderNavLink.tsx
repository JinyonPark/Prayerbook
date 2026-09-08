"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { perfMark } from "@/lib/perf/marks";

type Props = {
  href: string;
  className?: string;
  children: ReactNode;
  onNavigate?: () => void | false;
  prefetch?: boolean;
};

export function ReaderNavLink({ href, className, children, onNavigate, prefetch = true }: Props) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={className}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        perfMark("prayer_navigation_click");
        if (onNavigate?.() === false) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </Link>
  );
}
