"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { InstallButton } from "@/components/pwa/InstallButton";

const items = [
  { href: "/", label: "홈" },
  { href: "/prayers", label: "기도" },
  { href: "/history", label: "기록" },
  { href: "/settings", label: "설정" },
];

export function AppHeader({ title, hiddenOnMobile = false }: { title: string; hiddenOnMobile?: boolean }) {
  const pathname = usePathname();
  return (
    <header
      className={`app-header sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur ${
        hiddenOnMobile ? "max-lg:hidden" : ""
      }`}
    >
      <div className="mx-auto flex min-h-14 max-w-6xl items-center gap-3 px-5">
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
        {pathname === "/install" ? null : <InstallButton variant="header" />}
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="주요 메뉴"
      className="bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--card)] lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`touch-target flex items-center justify-center px-2 py-3 text-sm ${active ? "font-semibold text-[var(--accent)]" : "text-[var(--muted)]"}`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SideNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="주요 메뉴" className="hidden lg:block">
      <ul className="space-y-1">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`touch-target flex items-center rounded-xl px-3 ${active ? "bg-[var(--card)] font-semibold" : "text-[var(--muted)]"}`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({
  title,
  children,
  hideBottomNav = false,
  hideHeaderOnMobile = false,
  compactMobilePadding = false,
}: {
  title: string;
  children: React.ReactNode;
  hideBottomNav?: boolean;
  hideHeaderOnMobile?: boolean;
  compactMobilePadding?: boolean;
}) {
  return (
    <div className="min-h-dvh">
      <AppHeader title={title} hiddenOnMobile={hideHeaderOnMobile} />
      <div
        className={`mx-auto grid max-w-[92rem] gap-6 lg:grid-cols-[12rem_minmax(0,1fr)] ${
          compactMobilePadding ? "px-0 py-0 lg:px-5 lg:py-4" : "px-5 py-4"
        }`}
      >
        <aside className="hidden pt-2 lg:block">
          <SideNav />
        </aside>
        <main id="main" className={hideBottomNav ? "pb-8" : "pb-24 lg:pb-8"}>
          {children}
        </main>
      </div>
      {hideBottomNav ? null : <BottomNav />}
    </div>
  );
}
