"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { parseNameList, sanitizePlainText, type PrayerInputValues } from "@/lib/prayers/inputs";

export function PrayerInputEditor({
  slug,
  values,
  onSave,
  pending,
  status,
  onOpenChange,
}: {
  slug: string;
  values: PrayerInputValues;
  onSave: (values: PrayerInputValues) => Promise<void>;
  pending: boolean;
  status: "idle" | "saving" | "saved" | "failed";
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    child_names: (values.child_names ?? []).join("\n"),
    disease_target_name: values.disease_target_name ?? "",
    disease_name: values.disease_name ?? "",
    wish_text: values.wish_text ?? "",
    forgiveness_person_name: values.forgiveness_person_name ?? "",
    evangelism_target_name: values.evangelism_target_name ?? "",
  });
  const kind =
    slug === "children"
      ? "children"
      : slug === "heal-sickness"
        ? "disease"
        : slug === "hope-prayer"
          ? "wish"
          : slug === "conceived-prayer"
            ? "evangelism"
            : null;

  useEffect(() => {
    if (open) return;
    setDraft({
      child_names: (values.child_names ?? []).join("\n"),
      disease_target_name: values.disease_target_name ?? "",
      disease_name: values.disease_name ?? "",
      wish_text: values.wish_text ?? "",
      forgiveness_person_name: values.forgiveness_person_name ?? "",
      evangelism_target_name: values.evangelism_target_name ?? "",
    });
  }, [values, open]);

  if (!kind) return null;

  const title =
    kind === "children"
      ? "자녀 이름 입력"
      : kind === "disease"
        ? "기도 대상 설정"
        : kind === "wish"
          ? "내용 편집"
          : "태신자 이름 편집";

  function setOpenState(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  return (
    <>
      <Button type="button" variant="secondary" className="w-full" onClick={() => setOpenState(true)}>
        {title}
      </Button>
      <Modal
        open={open}
        title={title}
        onClose={() => setOpenState(false)}
        footer={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={pending}
              onClick={async () => {
                const next: PrayerInputValues = { ...values };
                if (kind === "children") next.child_names = parseNameList(draft.child_names);
                if (kind === "disease") {
                  next.disease_target_name = sanitizePlainText(draft.disease_target_name, 40);
                  next.disease_name = sanitizePlainText(draft.disease_name, 40);
                }
                if (kind === "wish") {
                  next.wish_text = sanitizePlainText(draft.wish_text, 80);
                  next.forgiveness_person_name = sanitizePlainText(draft.forgiveness_person_name, 40);
                }
                if (kind === "evangelism") {
                  next.evangelism_target_name = sanitizePlainText(draft.evangelism_target_name, 40);
                }
                try {
                  await onSave(next);
                  setOpenState(false);
                } catch {
                  /* keep draft and modal open */
                }
              }}
            >
              {pending ? "저장 중" : "저장"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpenState(false)}>
              닫기
            </Button>
          </div>
        }
      >
        <form className="space-y-3" onSubmit={(event) => event.preventDefault()}>
          {kind === "children" ? (
            <label className="block">
              <span className="mb-1 block text-sm text-[var(--muted)]">여러 이름을 줄바꿈 또는 쉼표로 입력</span>
              <textarea
                className="min-h-32 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
                value={draft.child_names}
                maxLength={400}
                onChange={(event) => setDraft((current) => ({ ...current, child_names: event.target.value }))}
              />
            </label>
          ) : null}
          {kind === "disease" ? (
            <>
              <label className="block">
                <span className="mb-1 block text-sm">기도 대상자 이름</span>
                <input className="touch-target w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" value={draft.disease_target_name} maxLength={40} onChange={(event) => setDraft((current) => ({ ...current, disease_target_name: event.target.value }))} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm">질병명 또는 아픈 부위</span>
                <input className="touch-target w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" value={draft.disease_name} maxLength={40} onChange={(event) => setDraft((current) => ({ ...current, disease_name: event.target.value }))} />
              </label>
            </>
          ) : null}
          {kind === "wish" ? (
            <>
              <label className="block">
                <span className="mb-1 block text-sm">나의 소원</span>
                <input className="touch-target w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" value={draft.wish_text} maxLength={80} onChange={(event) => setDraft((current) => ({ ...current, wish_text: event.target.value }))} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm">용서할 사람의 이름</span>
                <input className="touch-target w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" value={draft.forgiveness_person_name} maxLength={40} onChange={(event) => setDraft((current) => ({ ...current, forgiveness_person_name: event.target.value }))} />
              </label>
            </>
          ) : null}
          {kind === "evangelism" ? (
            <label className="block">
              <span className="mb-1 block text-sm">태신자 이름</span>
              <input className="touch-target w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" value={draft.evangelism_target_name} maxLength={40} onChange={(event) => setDraft((current) => ({ ...current, evangelism_target_name: event.target.value }))} />
            </label>
          ) : null}
          {status === "failed" ? <p role="alert">저장에 실패했습니다. 입력한 내용은 화면에 남아 있습니다.</p> : null}
        </form>
      </Modal>
    </>
  );
}
