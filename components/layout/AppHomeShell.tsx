"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppBootSkeleton } from "@/components/layout/AppBootSkeleton";
import { useAppState } from "@/components/providers/AppProviders";
import { perfLog, perfMark, perfMeasure } from "@/lib/perf/marks";

export function AppHomeShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { bootReady } = useAppState();

  useEffect(() => {
    perfMark("home_shell_visible");
  }, []);

  useEffect(() => {
    if (!bootReady || pathname !== "/") return;
    perfMark("home_interactive");
    perfMeasure("home_shell_to_interactive", "home_shell_visible", "home_interactive");
    perfMeasure("home_data", "home_data_request_start", "home_data_ready");
    perfLog("home");
  }, [bootReady, pathname]);

  if (pathname === "/" && !bootReady) {
    return <AppBootSkeleton />;
  }
  return children;
}
