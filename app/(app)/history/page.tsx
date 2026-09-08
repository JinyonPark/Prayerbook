import { AppShell } from "@/components/layout/AppShell";
import { HistoryView } from "@/components/history/HistoryView";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadPrayerItems } from "@/lib/prayers/load";
import { hasPublicEnv } from "@/lib/validation/env";
import type { HistoryOperation } from "@/lib/progress/types";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  if (!hasPublicEnv()) {
    return (
      <AppShell title="횟수 수정·초기화 이력">
        <p>환경 변수가 없어 이력을 불러올 수 없습니다.</p>
      </AppShell>
    );
  }

  const supabase = await createServerSupabaseClient();
  const prayers = loadPrayerItems();
  const { data } = await supabase
    .from("prayer_progress_operations")
    .select("id, operation_type, created_at, prayer_progress_operation_items(prayer_item_id, before_count, after_count)")
    .neq("operation_type", "complete")
    .order("created_at", { ascending: false })
    .limit(40);

  const operations: HistoryOperation[] = (data ?? []).map((operation) => ({
    id: operation.id,
    operation_type: operation.operation_type,
    created_at: operation.created_at,
    items: (operation.prayer_progress_operation_items ?? []).map((item) => {
      const prayer = prayers.find((candidate) => candidate.id === item.prayer_item_id);
      return {
        prayer_item_id: item.prayer_item_id,
        title: prayer?.title ?? "기도",
        item_number: prayer?.item_number ?? null,
        before_count: item.before_count,
        after_count: item.after_count,
      };
    }),
  }));

  return (
    <AppShell title="횟수 수정·초기화 이력">
      <HistoryView operations={operations} />
    </AppShell>
  );
}
