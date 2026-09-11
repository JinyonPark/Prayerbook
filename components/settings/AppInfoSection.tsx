"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AppShareSheet } from "@/components/settings/AppShareSheet";
import { APP_VERSION } from "@/lib/app-version";

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-[var(--muted)]" aria-hidden="true">
      <path
        d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InstallIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-[var(--muted)]" aria-hidden="true">
      <path
        d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-[var(--muted)]" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 10.5V17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-[var(--muted)]" aria-hidden="true">
      <path
        d="M9 6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsRow({
  icon,
  title,
  description,
  chevron,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  chevron?: boolean;
}) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="mt-0.5 block text-sm text-[var(--muted)]">{description}</span>
      </span>
      {chevron ? <ChevronIcon /> : null}
    </span>
  );
}

const rowClassName = "touch-target flex min-w-0 w-full items-center py-3 text-left";

export function AppInfoSection() {
  const [shareOpen, setShareOpen] = useState(false);
  const shareTriggerRef = useRef<HTMLButtonElement>(null);

  function closeShare() {
    setShareOpen(false);
    queueMicrotask(() => {
      shareTriggerRef.current?.focus();
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5" data-testid="app-info-section">
      <h2 className="text-lg font-semibold">앱 정보 및 공유</h2>
      <div className="mt-1 divide-y divide-[var(--border)]">
        <button
          ref={shareTriggerRef}
          type="button"
          className={rowClassName}
          aria-haspopup="dialog"
          aria-expanded={shareOpen}
          data-testid="app-share-trigger"
          onClick={() => setShareOpen(true)}
        >
          <SettingsRow icon={<ShareIcon />} title="기도훈련집 공유하기" description="가족과 지인에게 공유하기" chevron />
        </button>
        <Link href="/install" className={rowClassName} data-testid="app-install-guide">
          <SettingsRow
            icon={<InstallIcon />}
            title="앱 설치 안내"
            description="홈 화면에 설치하여 앱처럼 사용할 수 있습니다."
            chevron
          />
        </Link>
        <div className={rowClassName} data-testid="app-version-row">
          <SettingsRow icon={<InfoIcon />} title="버전 정보" description={`v${APP_VERSION}`} />
        </div>
      </div>
      <AppShareSheet open={shareOpen} onClose={closeShare} />
    </section>
  );
}
