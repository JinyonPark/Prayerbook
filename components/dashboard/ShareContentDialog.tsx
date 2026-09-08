"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAppState } from "@/components/providers/AppProviders";
import { copyTextToClipboard, shareOrCopyText } from "@/lib/progress/clipboard";
import { shareRecordInputFromDaily, type DailyPrayerSummary, type DailyShareProgress } from "@/lib/progress/daily";
import {
  COPY_FAILURE_MESSAGE,
  COPY_SUCCESS_MESSAGE,
  SHARE_COPY_FALLBACK_MESSAGE,
  SHARE_DIALOG_DESCRIPTION,
  SHARE_DIALOG_TITLE,
  SHARE_FIELD_IDS,
  SHARE_FIELD_LABELS,
  SHARE_FAILURE_MESSAGE,
  SHARE_TEXT_MAX_LENGTH,
  SHARE_RECORD_TITLE,
  applyShareFieldToggle,
  createShareDialogState,
  editShareText,
  formatShareFieldValue,
  rebuildShareTextFromSelection,
  refreshShareDialogStats,
  shareActionBlockMessage,
  shareActionBlockReason,
  shareFormatFromState,
  type ShareDialogState,
  type ShareFieldId,
} from "@/lib/progress/share-content";

type Props = {
  dailySummary: DailyPrayerSummary;
  progress: DailyShareProgress;
  onRefresh: () => Promise<boolean>;
};

export function ShareContentDialog({ dailySummary, progress, onRefresh }: Props) {
  const { shareFormat, updateShareFormat } = useAppState();
  const descriptionId = useId();
  const editorId = useId();
  const liveId = useId();
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const copyActionRef = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const openRef = useRef(false);
  const input = useMemo(
    () => shareRecordInputFromDaily(dailySummary, progress),
    [dailySummary, progress],
  );
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ShareDialogState>(() => createShareDialogState(input, shareFormat));
  const [revertConfirm, setRevertConfirm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"success" | "error">("success");

  openRef.current = open;

  useEffect(() => {
    if (!open) return;
    setState((previous) => refreshShareDialogStats(previous, input));
  }, [open, input]);

  function showNotice(message: string, tone: "success" | "error") {
    setNoticeTone(tone);
    setNotice(message);
  }

  function persistFormat(next: ShareDialogState) {
    void updateShareFormat(shareFormatFromState(next));
  }

  function closeDialog(save: boolean) {
    if (save) persistFormat(state);
    setOpen(false);
    setRevertConfirm(false);
    queueMicrotask(() => {
      openButtonRef.current?.focus();
    });
  }

  function openDialog() {
    if (openRef.current) return;
    setNotice(null);
    setRevertConfirm(false);
    setState(createShareDialogState(input, shareFormat));
    setOpen(true);
    void onRefresh();
  }

  async function onCopy() {
    if (busy.current) return;
    const blocked = shareActionBlockMessage(shareActionBlockReason(state.selected, state.editedText));
    if (blocked) {
      showNotice(blocked, "error");
      return;
    }
    busy.current = true;
    try {
      const ok = await copyTextToClipboard(state.editedText);
      showNotice(ok ? COPY_SUCCESS_MESSAGE : COPY_FAILURE_MESSAGE, ok ? "success" : "error");
      if (ok) persistFormat(state);
    } finally {
      busy.current = false;
    }
  }

  async function onShare() {
    if (busy.current) return;
    const blocked = shareActionBlockMessage(shareActionBlockReason(state.selected, state.editedText));
    if (blocked) {
      showNotice(blocked, "error");
      return;
    }
    busy.current = true;
    try {
      const result = await shareOrCopyText({
        title: SHARE_RECORD_TITLE,
        text: state.editedText,
      });
      if (result === "cancelled") return;
      persistFormat(state);
      if (result === "shared") {
        closeDialog(false);
        return;
      }
      if (result === "copied") {
        showNotice(SHARE_COPY_FALLBACK_MESSAGE, "success");
        return;
      }
      showNotice(SHARE_FAILURE_MESSAGE, "error");
    } catch {
      showNotice(SHARE_FAILURE_MESSAGE, "error");
    } finally {
      busy.current = false;
    }
  }

  function toggleField(field: ShareFieldId) {
    setState((previous) => applyShareFieldToggle(previous, field, input));
    setRevertConfirm(false);
  }

  const blockReason = shareActionBlockReason(state.selected, state.editedText);
  const blockMessage = shareActionBlockMessage(blockReason);

  return (
    <div className="mt-4">
      <Button
        ref={openButtonRef}
        type="button"
        className="w-full"
        aria-label="오늘의 기도 복사 또는 공유"
        onClick={openDialog}
      >
        복사·공유
      </Button>
      <p
        className={`mt-2 min-h-6 whitespace-pre-line text-sm ${noticeTone === "error" ? "text-[var(--danger)]" : "text-[var(--success)]"}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {open ? null : notice}
      </p>
      <Modal
        open={open}
        title={SHARE_DIALOG_TITLE}
        descriptionId={descriptionId}
        initialFocusRef={copyActionRef}
        onClose={() => closeDialog(true)}
        footer={
          <div className="flex flex-col gap-2 min-[400px]:flex-row">
            <div className="flex gap-2 min-[400px]:contents">
              <Button type="button" variant="ghost" className="min-h-11 flex-1" onClick={() => closeDialog(false)}>
                취소
              </Button>
              <Button type="button" variant="secondary" className="min-h-11 w-full min-[400px]:flex-1" onClick={() => void onShare()}>
                공유
              </Button>
            </div>
            <Button
              ref={copyActionRef}
              type="button"
              className="min-h-11 w-full min-[400px]:flex-1"
              data-initial-focus="true"
              onClick={() => void onCopy()}
            >
              복사
            </Button>
          </div>
        }
      >
        <p id={descriptionId} className="text-sm text-[var(--muted)]">
          {SHARE_DIALOG_DESCRIPTION}
        </p>
        <fieldset className="mt-4">
          <legend className="font-medium">공유할 기록 선택</legend>
          <div className="mt-2 space-y-3">
            {SHARE_FIELD_IDS.map((field) => {
              const fieldId = `${editorId}-${field}`;
              return (
                <label key={field} htmlFor={fieldId} className="flex cursor-pointer items-start gap-3">
                  <input
                    id={fieldId}
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0"
                    checked={state.selected[field]}
                    aria-label={SHARE_FIELD_LABELS[field]}
                    onChange={() => toggleField(field)}
                  />
                  <span>
                    <span className="font-medium">{SHARE_FIELD_LABELS[field]}</span>
                    <span className="mt-0.5 block text-sm text-[var(--muted)]">{formatShareFieldValue(field, input)}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        {blockReason ? (
          <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
            {blockMessage}
          </p>
        ) : null}
        <div className="mt-4">
          <label htmlFor={editorId} className="font-medium">
            편집할 문구
          </label>
          <textarea
            id={editorId}
            value={state.editedText}
            maxLength={SHARE_TEXT_MAX_LENGTH}
            rows={8}
            wrap="soft"
            autoComplete="off"
            spellCheck={false}
            className="mt-2 w-full min-w-0 resize-y overflow-x-hidden whitespace-pre-wrap break-words rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
            onChange={(event) => setState((previous) => editShareText(previous, event.target.value, input))}
          />
          <p className="mt-1 text-sm text-[var(--muted)]">
            {state.editedText.length} / {SHARE_TEXT_MAX_LENGTH}
          </p>
        </div>
        <div className="mt-3">
          {revertConfirm ? (
            <div className="rounded-xl border border-[var(--border)] p-3">
              <p>편집한 문구를 기본 문구로 바꿀까요?</p>
              <div className="mt-2 flex gap-2">
                <Button type="button" variant="ghost" className="min-h-11 flex-1" onClick={() => setRevertConfirm(false)}>
                  취소
                </Button>
                <Button
                  type="button"
                  className="min-h-11 flex-1"
                  onClick={() => {
                    setState((previous) => rebuildShareTextFromSelection(previous, input));
                    setRevertConfirm(false);
                  }}
                >
                  되돌리기
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => {
                if (state.isDirty) setRevertConfirm(true);
                else setState((previous) => rebuildShareTextFromSelection(previous, input));
              }}
            >
              기본 문구로 되돌리기
            </Button>
          )}
        </div>
        <p
          id={liveId}
          className={`mt-3 min-h-6 whitespace-pre-line text-sm ${noticeTone === "error" ? "text-[var(--danger)]" : "text-[var(--success)]"}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {open ? notice : null}
        </p>
      </Modal>
    </div>
  );
}
