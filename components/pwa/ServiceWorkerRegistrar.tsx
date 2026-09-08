"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

export function ServiceWorkerRegistrar() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.getRegistration().then((registration) => {
      if (!registration) return;
      if (registration.waiting) setWaiting(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            setWaiting(registration.waiting);
          }
        });
      });
    });
  }, []);

  if (!waiting) return null;

  return (
    <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="mb-3">새 버전이 준비되었습니다.</p>
      <Button
        onClick={() => {
          waiting.postMessage({ type: "SKIP_WAITING" });
          window.location.reload();
        }}
      >
        업데이트
      </Button>
    </div>
  );
}

export function OfflineBanner({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <div role="status" className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
      오프라인 상태입니다. 이전에 연 기도문은 읽을 수 있지만, 완료 기록은 인터넷 연결 후에 저장할 수 있습니다.
    </div>
  );
}
