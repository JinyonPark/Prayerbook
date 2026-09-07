"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAppState } from "@/components/providers/AppProviders";
import {
  calculateProgressFromItems,
  previewBulkSetMain,
  previewCurrentRoundReset,
  previewSetCount,
} from "@/lib/progress/calculate";
import { MAIN_PRAYER_COUNT } from "@/lib/prayers/catalog";
import { parseCountInput } from "@/lib/validation/count";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  mapSummaryItems,
  rpcBulkSetMain,
  rpcResetAll,
  rpcResetCurrentRound,
  rpcResetItem,
  rpcResetMain,
  rpcSetCount,
} from "@/lib/supabase/rpc";
import { toUserMessage } from "@/lib/errors/user-message";
import type { PrayerItemRecord } from "@/lib/prayers/markdown";
import type { RpcMutationResult } from "@/lib/progress/types";

type EditState = {
  item: PrayerItemRecord;
  value: string;
};

export function ProgressManager({ prayers }: { prayers: PrayerItemRecord[] }) {
  const { summary, setSummary, online, spouseSelection } = useAppState();
  const items = useMemo(() => (summary ? mapSummaryItems(summary) : []), [summary]);
  const current = calculateProgressFromItems(items, spouseSelection);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [mainConfirm, setMainConfirm] = useState("");
  const [allConfirm, setAllConfirm] = useState("");
  const [bulkValue, setBulkValue] = useState("10");
  const [dialogs, setDialogs] = useState({
    resetItem: null as PrayerItemRecord | null,
    round: false,
    main: false,
    all: false,
    bulk: false,
    saveConfirm: false,
  });

  const parsedEdit = edit ? parseCountInput(edit.value) : null;
  const afterEdit = edit && parsedEdit?.ok ? previewSetCount(items, edit.item.id, parsedEdit.value) : items;
  const afterSummary = calculateProgressFromItems(afterEdit, spouseSelection);
  const totalDecreases = edit && parsedEdit?.ok && afterSummary.totalCompleted < current.totalCompleted;

  async function run(task: () => Promise<RpcMutationResult>, successText: string) {
    setPending(true);
    setError(null);
    try {
      const data = await task();
      setSummary(data);
      setResult(
        `${successText} Total ${data.current_total}독, ${data.current_round}독 진행 중 ${data.current_completed_count}/${current.eligibleCount}`,
      );
      return data;
    } catch (err) {
      setError(toUserMessage(err));
      throw err;
    } finally {
      setPending(false);
    }
  }

  function clientEventId() {
    return crypto.randomUUID();
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <p>현재 Total {current.totalCompleted}독</p>
        <p>
          {current.currentRound}독 진행 중 {current.currentCompletedCount}/{current.eligibleCount}
        </p>
        {!online ? <p className="mt-2">인터넷 연결이 필요합니다. 연결 후 기도 완료 기록을 저장할 수 있습니다.</p> : null}
        {result ? <p className="mt-2">{result}</p> : null}
        {error ? <p role="alert">{error}</p> : null}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">항목별 완료 횟수</h2>
        <ul className="space-y-2">
          {prayers.map((prayer) => {
            const count = items.find((item) => item.id === prayer.id)?.completionCount ?? 0;
            return (
              <li key={prayer.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
                <p className="font-medium">
                  {prayer.item_number ? `${prayer.item_number}. ` : ""}
                  {prayer.title}
                </p>
                <p className="text-sm text-[var(--muted)]">현재 완료 횟수 {count}회</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" disabled={!online} onClick={() => setEdit({ item: prayer, value: String(count) })}>
                    수정
                  </Button>
                  <Button variant="secondary" disabled={!online} onClick={() => setDialogs((d) => ({ ...d, resetItem: prayer }))}>
                    초기화
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-lg font-semibold">일괄 작업</h2>
        <Button variant="secondary" disabled={!online} onClick={() => setDialogs((d) => ({ ...d, round: true }))}>
          현재 진행 독수 초기화
        </Button>
        <Button variant="secondary" disabled={!online} onClick={() => setDialogs((d) => ({ ...d, bulk: true }))}>
          기본 기도 완료 횟수 일괄 설정
        </Button>
        <Button variant="danger" disabled={!online} onClick={() => setDialogs((d) => ({ ...d, main: true }))}>
          기본 기도 전체 초기화
        </Button>
      </section>

      <section className="rounded-2xl border border-[var(--danger)] bg-[var(--card)] p-5">
        <h2 className="text-lg font-semibold">모든 기도 기록 초기화</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          이 작업은 회원 탈퇴가 아닙니다. 계정과 읽기 설정, 마지막 읽기 위치는 유지됩니다.
        </p>
        <Button variant="danger" className="mt-3" disabled={!online} onClick={() => setDialogs((d) => ({ ...d, all: true }))}>
          모든 기록 초기화
        </Button>
      </section>

      <Modal
        open={Boolean(edit)}
        title={edit ? `${edit.item.item_number ? `${edit.item.item_number}. ` : ""}${edit.item.title}` : "수정"}
        onClose={() => setEdit(null)}
        closeDisabled={pending}
      >
        {edit ? (
          <div className="space-y-3">
            <p>현재 완료 횟수 {(items.find((item) => item.id === edit.item.id)?.completionCount ?? 0)}회</p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  const parsed = parseCountInput(edit.value);
                  const next = parsed.ok ? Math.max(0, parsed.value - 1) : 0;
                  setEdit({ ...edit, value: String(next) });
                }}
              >
                -
              </Button>
              <input
                inputMode="numeric"
                className="touch-target w-24 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-center"
                value={edit.value}
                onChange={(event) => setEdit({ ...edit, value: event.target.value })}
              />
              <Button
                variant="secondary"
                onClick={() => {
                  const parsed = parseCountInput(edit.value);
                  const next = parsed.ok ? parsed.value + 1 : 1;
                  setEdit({ ...edit, value: String(next) });
                }}
              >
                +
              </Button>
            </div>
            {parsedEdit && !parsedEdit.ok ? <p role="alert">{parsedEdit.message}</p> : null}
            <p>
              변경 전: Total {current.totalCompleted}독 · {current.currentRound}독 진행 중 {current.currentCompletedCount}/{current.eligibleCount}
            </p>
            <p>
              변경 후 예상: Total {afterSummary.totalCompleted}독 · {afterSummary.currentRound}독 진행 중 {afterSummary.currentCompletedCount}/{current.eligibleCount}
            </p>
            {totalDecreases ? (
              <p>
                이 변경으로 Total 완료 횟수가 {current.totalCompleted}독에서 {afterSummary.totalCompleted}독으로 변경됩니다.
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button variant="secondary" disabled={pending} onClick={() => setEdit(null)}>
                취소
              </Button>
              <Button
                disabled={pending || !parsedEdit?.ok || !online}
                onClick={async () => {
                  if (!parsedEdit?.ok) return;
                  if (totalDecreases && !dialogs.saveConfirm) {
                    setDialogs((d) => ({ ...d, saveConfirm: true }));
                    return;
                  }
                  const supabase = createBrowserSupabaseClient();
                  await run(
                    () => rpcSetCount(supabase, edit.item.id, parsedEdit.value, clientEventId()),
                    "저장했습니다.",
                  );
                  setEdit(null);
                  setDialogs((d) => ({ ...d, saveConfirm: false }));
                }}
              >
                {pending ? "저장 중" : totalDecreases && !dialogs.saveConfirm ? "변경" : "변경 저장"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(dialogs.resetItem)}
        title="항목 초기화"
        onClose={() => setDialogs((d) => ({ ...d, resetItem: null }))}
        closeDisabled={pending}
      >
        {dialogs.resetItem ? (
          <div className="space-y-3">
            <p>
              {dialogs.resetItem.item_number ? `${dialogs.resetItem.item_number}. ` : ""}
              {dialogs.resetItem.title}
            </p>
            <p>현재 누적 {items.find((item) => item.id === dialogs.resetItem?.id)?.completionCount ?? 0}회</p>
            <p>이 항목을 0회로 초기화합니다. 다른 항목은 유지됩니다.</p>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={pending} onClick={() => setDialogs((d) => ({ ...d, resetItem: null }))}>
                취소
              </Button>
              <Button
                disabled={pending}
                onClick={async () => {
                  const supabase = createBrowserSupabaseClient();
                  await run(() => rpcResetItem(supabase, dialogs.resetItem!.id, clientEventId()), "초기화했습니다.");
                  setDialogs((d) => ({ ...d, resetItem: null }));
                }}
              >
                이 항목을 0회로 초기화
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmPreview
        open={dialogs.round}
        title="현재 진행 독수 초기화"
        pending={pending}
        before={current}
        after={calculateProgressFromItems(previewCurrentRoundReset(items))}
        description="이미 완료한 Total은 유지하고, 현재 진행 중인 독수에서 앞선 기록만 제거합니다. 추가 기도는 변경하지 않습니다."
        onClose={() => setDialogs((d) => ({ ...d, round: false }))}
        onConfirm={async () => {
          const supabase = createBrowserSupabaseClient();
          await run(() => rpcResetCurrentRound(supabase, clientEventId()), "초기화했습니다.");
          setDialogs((d) => ({ ...d, round: false }));
        }}
      />

      <Modal open={dialogs.main} title="기본 기도 전체 초기화" onClose={() => setDialogs((d) => ({ ...d, main: false }))} closeDisabled={pending}>
        <p>기본 기도 기록을 모두 초기화하시겠습니까?</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          <li>기본 기도 1~{MAIN_PRAYER_COUNT}번이 모두 0회로 변경됩니다.</li>
          <li>현재 Total {current.totalCompleted}독 기록도 0독으로 변경됩니다.</li>
          <li>추가 기도 기록은 유지됩니다.</li>
          <li>계정과 읽기 설정은 유지됩니다.</li>
        </ul>
        <p className="mt-3 text-sm">확인을 위해 초기화를 입력하세요.</p>
        <input className="touch-target mt-2 w-full rounded-xl border border-[var(--border)] px-3" value={mainConfirm} onChange={(e) => setMainConfirm(e.target.value)} />
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" disabled={pending} onClick={() => setDialogs((d) => ({ ...d, main: false }))}>
            취소
          </Button>
          <Button
            variant="danger"
            disabled={pending || mainConfirm !== "초기화"}
            onClick={async () => {
              const supabase = createBrowserSupabaseClient();
              await run(() => rpcResetMain(supabase, clientEventId()), "초기화했습니다.");
              setMainConfirm("");
              setDialogs((d) => ({ ...d, main: false }));
            }}
          >
            초기화
          </Button>
        </div>
      </Modal>

      <Modal open={dialogs.all} title="모든 기도 기록 초기화" onClose={() => setDialogs((d) => ({ ...d, all: false }))} closeDisabled={pending}>
        <p>기본 기도와 추가 기도 완료 횟수를 모두 0으로 변경합니다. 계정과 읽기 설정은 유지됩니다.</p>
        <p className="mt-3 text-sm">확인을 위해 모든 기록 초기화를 입력하세요.</p>
        <input className="touch-target mt-2 w-full rounded-xl border border-[var(--border)] px-3" value={allConfirm} onChange={(e) => setAllConfirm(e.target.value)} />
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" disabled={pending} onClick={() => setDialogs((d) => ({ ...d, all: false }))}>
            취소
          </Button>
          <Button
            variant="danger"
            disabled={pending || allConfirm !== "모든 기록 초기화"}
            onClick={async () => {
              const supabase = createBrowserSupabaseClient();
              await run(() => rpcResetAll(supabase, clientEventId()), "초기화했습니다.");
              setAllConfirm("");
              setDialogs((d) => ({ ...d, all: false }));
            }}
          >
            초기화
          </Button>
        </div>
      </Modal>

      <Modal open={dialogs.bulk} title="기본 기도 완료 횟수 일괄 설정" onClose={() => setDialogs((d) => ({ ...d, bulk: false }))} closeDisabled={pending}>
        <p>1~{MAIN_PRAYER_COUNT}번 완료 횟수를 같은 값으로 덮어씁니다. 추가 기도는 변경하지 않습니다.</p>
        <label className="mt-3 block">
          1~{MAIN_PRAYER_COUNT}번 완료 횟수
          <input className="touch-target mt-1 w-full rounded-xl border border-[var(--border)] px-3" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} />
        </label>
        {(() => {
          const parsed = parseCountInput(bulkValue);
          if (!parsed.ok) return <p className="mt-2">{parsed.message}</p>;
          const after = calculateProgressFromItems(previewBulkSetMain(items, parsed.value));
          return (
            <div className="mt-3 space-y-1 text-sm">
              <p>
                변경 전: Total {current.totalCompleted}독 · {current.currentRound}독 {current.currentCompletedCount}/{current.eligibleCount}
              </p>
              <p>
                변경 후: Total {after.totalCompleted}독 · {after.currentRound}독 {after.currentCompletedCount}/{current.eligibleCount}
              </p>
            </div>
          );
        })()}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" disabled={pending} onClick={() => setDialogs((d) => ({ ...d, bulk: false }))}>
            취소
          </Button>
          <Button
            disabled={pending || !parseCountInput(bulkValue).ok}
            onClick={async () => {
              const parsed = parseCountInput(bulkValue);
              if (!parsed.ok) return;
              const supabase = createBrowserSupabaseClient();
              await run(() => rpcBulkSetMain(supabase, parsed.value, clientEventId()), "적용했습니다.");
              setDialogs((d) => ({ ...d, bulk: false }));
            }}
          >
            적용
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function ConfirmPreview({
  open,
  title,
  description,
  before,
  after,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  before: ReturnType<typeof calculateProgressFromItems>;
  after: ReturnType<typeof calculateProgressFromItems>;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose} closeDisabled={pending}>
      <p>{description}</p>
      <p className="mt-3">
        변경 전: Total {before.totalCompleted}독 · {before.currentRound}독 {before.currentCompletedCount}/{before.eligibleCount}
      </p>
      <p>
        변경 후: Total {after.totalCompleted}독 · {after.currentRound}독 {after.currentCompletedCount}/{after.eligibleCount}
      </p>
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" disabled={pending} onClick={onClose}>
          취소
        </Button>
        <Button disabled={pending} onClick={() => void onConfirm()}>
          {pending ? "저장 중" : "확인"}
        </Button>
      </div>
    </Modal>
  );
}
