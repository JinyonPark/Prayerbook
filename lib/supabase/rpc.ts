import type { PrayerCountItem } from "@/lib/progress/calculate";
import { normalizeDailySummary, type DailyPrayerSummary } from "@/lib/progress/daily";
import type { RpcMutationResult, RpcProgressSummary } from "@/lib/progress/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export function mapSummaryItems(summary: RpcProgressSummary): PrayerCountItem[] {
  return summary.items.map((item) => ({
    id: item.prayer_item_id,
    category: item.category,
    countsTowardTotal: item.counts_toward_total,
    itemNumber: item.item_number,
    displayOrder: item.display_order,
    completionCount: item.completion_count,
  }));
}

export async function fetchProgressSummary(supabase: SupabaseClient): Promise<RpcProgressSummary> {
  const { data, error } = await supabase.rpc("get_prayer_progress_summary");
  if (error) throw error;
  return data as RpcProgressSummary;
}

export async function fetchDailyPrayerSummary(
  supabase: SupabaseClient,
  targetDate?: string | null,
): Promise<DailyPrayerSummary> {
  const { data, error } = await supabase.rpc("get_daily_prayer_summary", {
    target_date: targetDate ?? null,
  });
  if (error) throw error;
  return normalizeDailySummary(data);
}

export async function rpcComplete(
  supabase: SupabaseClient,
  prayerItemId: string,
  clientEventId: string,
): Promise<RpcMutationResult> {
  const { data, error } = await supabase.rpc("complete_prayer", {
    prayer_item_id: prayerItemId,
    client_event_id: clientEventId,
  });
  if (error) throw error;
  return data as RpcMutationResult;
}

export async function rpcSetCount(
  supabase: SupabaseClient,
  prayerItemId: string,
  newCount: number,
  clientEventId: string,
): Promise<RpcMutationResult> {
  const { data, error } = await supabase.rpc("set_prayer_count", {
    prayer_item_id: prayerItemId,
    new_count: newCount,
    client_event_id: clientEventId,
  });
  if (error) throw error;
  return data as RpcMutationResult;
}

export async function rpcResetItem(
  supabase: SupabaseClient,
  prayerItemId: string,
  clientEventId: string,
): Promise<RpcMutationResult> {
  const { data, error } = await supabase.rpc("reset_prayer_item", {
    prayer_item_id: prayerItemId,
    client_event_id: clientEventId,
  });
  if (error) throw error;
  return data as RpcMutationResult;
}

export async function rpcResetCurrentRound(
  supabase: SupabaseClient,
  clientEventId: string,
): Promise<RpcMutationResult> {
  const { data, error } = await supabase.rpc("reset_current_round", {
    client_event_id: clientEventId,
  });
  if (error) throw error;
  return data as RpcMutationResult;
}

export async function rpcResetMain(
  supabase: SupabaseClient,
  clientEventId: string,
): Promise<RpcMutationResult> {
  const { data, error } = await supabase.rpc("reset_main_prayers", {
    client_event_id: clientEventId,
  });
  if (error) throw error;
  return data as RpcMutationResult;
}

export async function rpcResetAll(
  supabase: SupabaseClient,
  clientEventId: string,
): Promise<RpcMutationResult> {
  const { data, error } = await supabase.rpc("reset_all_prayers", {
    client_event_id: clientEventId,
  });
  if (error) throw error;
  return data as RpcMutationResult;
}

export async function rpcBulkSetMain(
  supabase: SupabaseClient,
  newCount: number,
  clientEventId: string,
): Promise<RpcMutationResult> {
  const { data, error } = await supabase.rpc("bulk_set_main_prayer_count", {
    new_count: newCount,
    client_event_id: clientEventId,
  });
  if (error) throw error;
  return data as RpcMutationResult;
}

export async function rpcDeleteHistoryOperation(supabase: SupabaseClient, operationId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_history_operation", {
    p_operation_id: operationId,
  });
  if (error) throw error;
}

export async function rpcDeleteAllHistory(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("delete_all_history");
  if (error) throw error;
}

export async function rpcSavePrayerInputs(
  supabase: SupabaseClient,
  prayerItemId: string,
  values: Record<string, unknown>,
) {
  const { data, error } = await supabase.rpc("save_prayer_inputs", {
    prayer_item_id: prayerItemId,
    values,
  });
  if (error) throw error;
  return data as { prayer_item_id: string; values: Record<string, unknown> };
}
