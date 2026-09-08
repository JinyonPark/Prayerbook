"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

type Props = {
  href: string;
  className?: string;
  children: ReactNode;
  onNavigate?: () => void | false;
};

export function ReaderNavLink({ href, className, children, onNavigate }: Props) {
  const router = useRouter();
  return (
    <a
      href={href}
      className={className}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        if (onNavigate?.() === false) return;
        router.push(href);
      }}
    >
      {children}
    </a>
  );
}
