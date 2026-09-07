"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { InstallButton } from "@/components/pwa/InstallButton";
import { detectPlatform, getInstallSteps, isStandaloneDisplay } from "@/lib/pwa/detect";
import { INSTALL_DISMISS_KEY } from "@/lib/theme/preferences";

export function InstallCard({ compact = false }: { compact?: boolean }) {
  const [standalone, setStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [platform, setPlatform] = useState(detectPlatform());

  useEffect(() => {
    setStandalone(isStandaloneDisplay());
    setPlatform(detectPlatform());
    const until = Number(window.localStorage.getItem(INSTALL_DISMISS_KEY) ?? 0);
    setDismissed(Date.now() < until);
  }, []);

  if (standalone || dismissed) return null;

  const guide = getInstallSteps(platform);

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h2 className="text-lg font-semibold">기도훈련집을 앱으로 설치하세요</h2>
      <p className="mt-2 text-[var(--muted)]">
        홈 화면이나 PC에서 바로 실행할 수 있습니다. 기도 기록은 동일한 계정으로 모든 기기에서 이어집니다.
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        PWA는 기기마다 설치됩니다. 앱을 삭제해도 서버의 기도 기록은 유지됩니다.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <InstallButton />
        <Link href="/install" className="touch-target inline-flex items-center rounded-xl border border-[var(--border)] px-4">
          설치 방법 보기
        </Link>
        <Button
          variant="ghost"
          onClick={() => {
            const until = Date.now() + 14 * 24 * 60 * 60 * 1000;
            window.localStorage.setItem(INSTALL_DISMISS_KEY, String(until));
            setDismissed(true);
          }}
        >
          나중에
        </Button>
      </div>
      {compact ? null : (
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-[var(--muted)]">
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function InstallGuide() {
  const [platform, setPlatform] = useState(detectPlatform());
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setStandalone(isStandaloneDisplay());
  }, []);

  const current = getInstallSteps(platform);
  const all = ["android", "iphone", "ipad", "windows-chrome", "windows-edge", "mac", "kakao"] as const;

  return (
    <div className="space-y-6">
      {standalone ? (
        <p className="rounded-2xl bg-[var(--card)] p-4">이미 앱으로 실행 중입니다.</p>
      ) : (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="text-lg font-semibold">이 기기에 설치</h2>
          <p className="mt-2 text-[var(--muted)]">
            설치되어 있지 않으면 버튼을 눌러 앱으로 추가할 수 있습니다. 바로 설치 창이 없는 기기는 아래 순서를 안내합니다.
          </p>
          <div className="mt-4">
            <InstallButton className="w-full sm:w-auto" />
          </div>
        </section>
      )}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-lg font-semibold">현재 기기: {current.title}</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          {current.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      {all.map((item) => {
        const guide = getInstallSteps(item);
        return (
          <section key={item} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            <h2 className="text-lg font-semibold">{guide.title}</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
