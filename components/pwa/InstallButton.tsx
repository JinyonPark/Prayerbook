"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useInstallPrompt } from "@/components/pwa/InstallPromptProvider";
import { detectPlatform, getInstallSteps } from "@/lib/pwa/detect";

export function InstallButton({
  variant = "primary",
  className = "",
}: {
  variant?: "primary" | "secondary" | "header";
  className?: string;
}) {
  const { ready, installed, canNativeInstall, installNative } = useInstallPrompt();
  const [guideOpen, setGuideOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const platform = detectPlatform();
  const guide = getInstallSteps(platform);
  const isIos = platform === "iphone" || platform === "ipad";

  if (!ready || installed) return null;

  async function onClick() {
    if (pending) return;
    setPending(true);
    try {
      const result = await installNative();
      if (result === "unavailable") {
        setGuideOpen(true);
      }
    } finally {
      setPending(false);
    }
  }

  const label = pending ? "설치 중..." : "앱 설치";

  return (
    <>
      {variant === "header" ? (
        <button
          type="button"
          className={`touch-target shrink-0 rounded-xl bg-[var(--accent)] px-3 text-sm font-medium text-[var(--accent-text)] ${className}`}
          onClick={() => void onClick()}
          disabled={pending}
        >
          {label}
        </button>
      ) : (
        <Button
          type="button"
          variant={variant}
          className={className}
          onClick={() => void onClick()}
          disabled={pending}
        >
          {label}
        </Button>
      )}
      <Modal
        open={guideOpen}
        title="앱으로 설치하기"
        onClose={() => setGuideOpen(false)}
        footer={
          <div className="flex flex-wrap gap-2">
            <Link href="/install" className="touch-target inline-flex items-center rounded-xl bg-[var(--accent)] px-4 text-[var(--accent-text)]" onClick={() => setGuideOpen(false)}>
              기기별 설치 방법
            </Link>
            <Button variant="secondary" onClick={() => setGuideOpen(false)}>
              닫기
            </Button>
          </div>
        }
      >
        <p className="text-[var(--muted)]">{guide.title}에서 아래 순서로 설치할 수 있습니다.</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {isIos ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            iPhone, iPad는 브라우저에서 바로 설치 창이 열리지 않습니다. 공유 버튼으로 홈 화면에 추가하면 됩니다.
          </p>
        ) : !canNativeInstall ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            이 브라우저는 바로 설치 창을 열 수 없습니다. 아래 순서를 따라 주세요.
          </p>
        ) : null}
      </Modal>
    </>
  );
}
