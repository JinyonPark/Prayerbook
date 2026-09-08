"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { copyTextToClipboard, shareOrCopyText } from "@/lib/progress/clipboard";
import { shareRecordInputFromDaily, type DailyPrayerSummary, type DailyShareProgress } from "@/lib/progress/daily";
import {
  COPY_FAILURE_MESSAGE,
  COPY_SUCCESS_MESSAGE,
  SHARE_COPY_FALLBACK_MESSAGE,
  SHARE_FIELD_IDS,
  SHARE_FIELD_LABELS,
  SHARE_FAILURE_MESSAGE,
  SHARE_SELECTION_CHANGED_MESSAGE,
  SHARE_TEXT_MAX_LENGTH,
  SHARE_RECORD_TITLE,
  applyShareFieldToggle,
  createShareDialogState,
  editShareText,
  formatShareFieldLine,
  keepEditedShareText,
  rebuildShareTextFromSelection,
  refreshShareDialogStats,
  shareActionBlockMessage,
  shareActionBlockReason,
  shareDialogDescription,
  shareDialogTitle,
  type ShareDialogMode,
  type ShareDialogState,
  type ShareFieldId,
} from "@/lib/progress/share-content";

type Props = {
  dailySummary: DailyPrayerSummary;
  progress: DailyShareProgress;
  onRefresh: () => Promise<boolean>;
};

export function ShareContentDialog({ dailySummary, progress, onRefresh }: Props) {
  const descriptionId = useId();
  const editorId = useId();
  const liveId = useId();
  const primaryHintId = useId();
  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<ShareDialogMode>("copy");
  const busy = useRef(false);
  const openRef = useRef(false);
  const input = useMemo(
    () => shareRecordInputFromDaily(dailySummary, progress),
    [dailySummary, progress],
  );
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ShareDialogState>(() => createShareDialogState("copy", input));
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

  function closeDialog() {
    setOpen(false);
    setRevertConfirm(false);
    queueMicrotask(() => {
      (opener.current === "share" ? shareButtonRef : copyButtonRef).current?.focus();
    });
  }

  function openShareDialog(mode: ShareDialogMode) {
    if (openRef.current && state.mode === mode) return;
    opener.current = mode;
    setNotice(null);
    setRevertConfirm(false);
    setState(createShareDialogState(mode, input));
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
      if (result === "shared") {
        closeDialog();
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

  const title = shareDialogTitle(state.mode);
  const description = shareDialogDescription(state.mode);
  const copyIsPrimary = state.mode === "copy";
  const blockReason = shareActionBlockReason(state.selected, state.editedText);
  const blockMessage = shareActionBlockMessage(blockReason);
  const copyButton = (
    <Button
      ref={copyIsPrimary ? primaryActionRef : undefined}
      type="button"
      variant={copyIsPrimary ? "primary" : "secondary"}
      className="min-h-11 w-full min-[400px]:flex-1"
      data-initial-focus={copyIsPrimary ? "true" : undefined}
      aria-describedby={copyIsPrimary ? primaryHintId : undefined}
      onClick={() => void onCopy()}
    >
      복사
    </Button>
  );
  const shareButton = (
    <Button
      ref={copyIsPrimary ? undefined : primaryActionRef}
      type="button"
      variant={copyIsPrimary ? "secondary" : "primary"}
      className="min-h-11 w-full min-[400px]:flex-1"
      data-initial-focus={copyIsPrimary ? undefined : "true"}
      aria-describedby={copyIsPrimary ? undefined : primaryHintId}
      onClick={() => void onShare()}
    >
      공유
    </Button>
  );

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-2 min-[360px]:flex-row">
        <Button
          ref={copyButtonRef}
          type="button"
          className="w-full min-[360px]:flex-1"
          aria-label="오늘의 기도 결과 복사"
          onClick={() => openShareDialog("copy")}
        >
          결과 복사
        </Button>
        <Button
          ref={shareButtonRef}
          type="button"
          variant="secondary"
          className="w-full min-[360px]:flex-1"
          aria-label="오늘의 기도 결과 공유하기"
          onClick={() => openShareDialog("share")}
        >
          공유하기
        </Button>
      </div>
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
        title={title}
        descriptionId={descriptionId}
        initialFocusRef={primaryActionRef}
        onClose={closeDialog}
        footer={
          <div className="flex flex-col gap-2 min-[400px]:flex-row">
            <div className="flex gap-2 min-[400px]:contents">
              <Button type="button" variant="ghost" className="min-h-11 flex-1" onClick={closeDialog}>
                취소
              </Button>
              {copyIsPrimary ? shareButton : copyButton}
            </div>
            {copyIsPrimary ? copyButton : shareButton}
          </div>
        }
      >
        <p id={descriptionId} className="text-sm text-[var(--muted)]">
          {description}
        </p>
        <p id={primaryHintId} className="mt-1 text-sm text-[var(--muted)]">
          {copyIsPrimary ? "현재 주요 동작은 복사입니다." : "현재 주요 동작은 공유입니다."}
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
                    <span className="mt-0.5 block text-sm text-[var(--muted)]">{formatShareFieldLine(field, input)}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        {blockReason === "no_fields" ? (
          <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
            {blockMessage}
          </p>
        ) : null}
        {state.selectionChangedWhileDirty ? (
          <div className="mt-4 rounded-xl border border-[var(--border)] p-3">
            <p>{SHARE_SELECTION_CHANGED_MESSAGE}</p>
            <div className="mt-2 flex flex-col gap-2 min-[360px]:flex-row">
              <Button type="button" variant="secondary" className="min-h-11 flex-1" onClick={() => setState(keepEditedShareText)}>
                현재 편집 문구 유지
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 flex-1"
                onClick={() => setState((previous) => rebuildShareTextFromSelection(previous, input))}
              >
                선택 항목으로 다시 만들기
              </Button>
            </div>
          </div>
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
            onChange={(event) => setState((previous) => editShareText(previous, event.target.value))}
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
