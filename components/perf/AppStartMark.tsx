"use client";

import { useEffect } from "react";
import { perfMark } from "@/lib/perf/marks";

export function AppStartMark() {
  useEffect(() => {
    perfMark("app_start");
  }, []);
  return null;
}
