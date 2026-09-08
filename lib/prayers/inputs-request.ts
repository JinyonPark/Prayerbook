import type { SupabaseClient } from "@supabase/supabase-js";
import { inspectError, isAuthFailure, logDevError } from "@/lib/errors/inspect";
import { rpcSavePrayerInputs } from "@/lib/supabase/rpc";
import type { PrayerInputValues } from "@/lib/prayers/inputs";

class PrayerInputsRequestError extends Error {
  code: string;
  status: number;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "PrayerInputsRequestError";
    this.status = status;
    this.code = code;
  }
}

export async function savePrayerInputsViaSameOrigin(
  prayerItemId: string,
  values: PrayerInputValues,
): Promise<{ prayer_item_id: string; values: PrayerInputValues }> {
  const response = await fetch("/api/prayer-inputs", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prayerItemId, values }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    prayer_item_id?: string;
    values?: PrayerInputValues;
  };
  if (!response.ok) {
    throw new PrayerInputsRequestError(
      body.message || body.error || "MUTATION_FAILED",
      response.status,
      body.error || "MUTATION_FAILED",
    );
  }
  return {
    prayer_item_id: body.prayer_item_id ?? prayerItemId,
    values: (body.values ?? values) as PrayerInputValues,
  };
}

export async function savePrayerInputsRequest(
  supabase: SupabaseClient,
  prayerItemId: string,
  values: PrayerInputValues,
): Promise<{ prayer_item_id: string; values: PrayerInputValues }> {
  if (typeof window !== "undefined") {
    try {
      return await savePrayerInputsViaSameOrigin(prayerItemId, values);
    } catch (error) {
      logDevError("save_prayer_inputs_api", error);
      if (isAuthFailure(error) || inspectError(error).status === 401) {
        throw error;
      }
    }
  }
  const saved = await rpcSavePrayerInputs(supabase, prayerItemId, values);
  return {
    prayer_item_id: saved.prayer_item_id,
    values: saved.values as PrayerInputValues,
  };
}
