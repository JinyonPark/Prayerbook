"use client";

import { Button } from "@/components/ui/Button";
import type { AutoScrollSpeed } from "@/lib/prayers/inputs";

export function AutoScrollControls({
  running,
  speed,
  onToggle,
  onSpeed,
}: {
  running: boolean;
  speed: AutoScrollSpeed;
  onToggle: () => void;
  onSpeed: (speed: AutoScrollSpeed) => void;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4" aria-label="자동 스크롤">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={onToggle} aria-pressed={running}>
          {running ? "일시정지" : "자동 스크롤"}
        </Button>
        <p className="text-sm">{running ? "자동 스크롤 중" : "자동 스크롤 꺼짐"}</p>
      </div>
      <fieldset className="mt-3">
        <legend className="mb-2 text-sm text-[var(--muted)]">속도</legend>
        <div className="flex flex-wrap gap-2">
          {([
            ["slow", "느리게"],
            ["normal", "보통"],
            ["fast", "빠르게"],
          ] as const).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              variant={speed === value ? "primary" : "secondary"}
              aria-pressed={speed === value}
              onClick={() => onSpeed(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
