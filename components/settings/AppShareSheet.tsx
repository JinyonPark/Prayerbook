"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  APP_SHARE_COPY_FAILURE,
  APP_SHARE_COPY_SUCCESS,
  APP_SHARE_URL,
  copyPrayerBookUrl,
  sharePrayerBookApp,
} from "@/lib/share-app";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AppShareSheet({ open, onClose }: Props) {
  const descriptionId = useId();
  const shareActionRef = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"success" | "error">("success");

  function closeSheet() {
    setNotice(null);
    onClose();
  }

  async function onShare() {
    if (busy.current) return;
    busy.current = true;
    setNotice(null);
    try {
      const outcome = await sharePrayerBookApp();
      if (outcome === "shared" || outcome === "cancelled") return;
      if (outcome === "copied") {
        setNoticeTone("success");
        setNotice(APP_SHARE_COPY_SUCCESS);
        return;
      }
      setNoticeTone("error");
      setNotice(APP_SHARE_COPY_FAILURE);
    } finally {
      busy.current = false;
    }
  }

  async function onCopy() {
    if (busy.current) return;
    busy.current = true;
    setNotice(null);
    try {
      const ok = await copyPrayerBookUrl();
      setNoticeTone(ok ? "success" : "error");
      setNotice(ok ? APP_SHARE_COPY_SUCCESS : APP_SHARE_COPY_FAILURE);
    } finally {
      busy.current = false;
    }
  }

  return (
    <Modal
      open={open}
      title="기도훈련집 공유"
      variant="sheet"
      showHandle
      handleLabel="공유 화면 닫기"
      descriptionId={descriptionId}
      initialFocusRef={shareActionRef}
      onClose={closeSheet}
      footer={
        <div className="flex flex-col gap-2">
          <Button
            ref={shareActionRef}
            type="button"
            className="min-h-11 w-full whitespace-nowrap"
            data-initial-focus="true"
            data-testid="app-share-submit"
            onClick={() => void onShare()}
          >
            공유하기
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 w-full whitespace-nowrap"
            data-testid="app-share-copy"
            onClick={() => void onCopy()}
          >
            링크 복사
          </Button>
          <Button type="button" variant="ghost" className="min-h-11 w-full whitespace-nowrap" onClick={closeSheet}>
            취소
          </Button>
        </div>
      }
    >
      <p id={descriptionId} className="text-sm text-[var(--muted)]">
        기도훈련집을 가족이나 교회 지인에게 공유해 보세요.
      </p>
      <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-3">
        <p className="font-medium">기도훈련집</p>
        <p className="mt-1 select-all break-all text-sm text-[var(--muted)]" data-testid="app-share-url">
          {APP_SHARE_URL}
        </p>
      </div>
      <p
        className={`mt-3 min-h-6 whitespace-pre-line text-sm ${noticeTone === "error" ? "text-[var(--danger)]" : "text-[var(--success)]"}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="app-share-notice"
      >
        {open ? notice : null}
      </p>
    </Modal>
  );
}
