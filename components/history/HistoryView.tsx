"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAppState } from "@/components/providers/AppProviders";
import { toUserMessage } from "@/lib/errors/user-message";
import type { HistoryOperation } from "@/lib/progress/types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { rpcDeleteAllHistory, rpcDeleteHistoryOperation } from "@/lib/supabase/rpc";

const TYPE_LABEL: Record<string, string> = {
  complete: "기도 완료",
  manual_edit: "횟수 수정",
  item_reset: "항목 초기화",
  current_round_reset: "현재 독수 초기화",
  main_full_reset: "기본 기도 전체 초기화",
  all_full_reset: "모든 기록 초기화",
  bulk_set: "기본 기도 일괄 설정",
};

export function HistoryView({ operations }: { operations: HistoryOperation[] }) {
  const { online } = useAppState();
  const hiddenIds = useRef(new Set<string>());
  const clearedAll = useRef(false);
  const [items, setItems] = useState(operations);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"all" | HistoryOperation | null>(null);

  useEffect(() => {
    if (clearedAll.current) {
      setItems([]);
      return;
    }
    setItems(operations.filter((operation) => !hiddenIds.current.has(operation.id)));
  }, [operations]);

  async function removeOne(operation: HistoryOperation) {
    setError(null);
    hiddenIds.current.add(operation.id);
    setItems((current) => current.filter((item) => item.id !== operation.id));
    setConfirm(null);
    setPending(true);
    try {
      const supabase = createBrowserSupabaseClient();
      await rpcDeleteHistoryOperation(supabase, operation.id);
    } catch (err) {
      hiddenIds.current.delete(operation.id);
      setItems((current) =>
        current.some((item) => item.id === operation.id)
          ? current
          : [operation, ...current].sort(
              (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
            ),
      );
      setError(toUserMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function removeAll() {
    setError(null);
    const previous = items;
    clearedAll.current = true;
    setItems([]);
    setConfirm(null);
    setPending(true);
    try {
      const supabase = createBrowserSupabaseClient();
      await rpcDeleteAllHistory(supabase);
    } catch (err) {
      clearedAll.current = false;
      setItems(previous);
      setError(toUserMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="space-y-3">
        {error ? <p role="alert">{error}</p> : null}
        <p className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">아직 완료 기록이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--muted)]">목록에서만 지워지며, 기도 완료 횟수는 바뀌지 않습니다.</p>
        <Button variant="danger" disabled={!online || pending} onClick={() => setConfirm("all")}>
          기록 모두 삭제
        </Button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      {!online ? <p>인터넷 연결이 필요합니다. 연결 후 기록을 삭제할 수 있습니다.</p> : null}
      <ol className="space-y-3">
        {items.map((operation) => (
          <li key={operation.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{TYPE_LABEL[operation.operation_type] ?? operation.operation_type}</p>
                <p className="text-sm text-[var(--muted)]">{new Date(operation.created_at).toLocaleString("ko-KR")}</p>
              </div>
              <Button
                variant="secondary"
                disabled={!online || pending}
                onClick={() => setConfirm(operation)}
              >
                삭제
              </Button>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {operation.items.map((item) => (
                <li key={item.prayer_item_id}>
                  {item.item_number ? `${item.item_number}번 ` : ""}
                  {item.title}: {item.before_count} → {item.after_count}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <Modal
        open={confirm !== null}
        title={confirm === "all" ? "기록을 모두 삭제할까요?" : "이 기록을 삭제할까요?"}
        onClose={() => {
          if (!pending) setConfirm(null);
        }}
        closeDisabled={pending}
      >
        <p>
          {confirm === "all"
            ? "기록 목록이 모두 사라집니다. 기도 완료 횟수와 Total은 그대로 유지됩니다."
            : "이 항목만 기록 목록에서 사라집니다. 기도 완료 횟수와 Total은 그대로 유지됩니다."}
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" disabled={pending} onClick={() => setConfirm(null)}>
            취소
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => {
              if (confirm === "all") {
                void removeAll();
                return;
              }
              if (confirm) void removeOne(confirm);
            }}
          >
            {pending ? "삭제 중" : "삭제"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
