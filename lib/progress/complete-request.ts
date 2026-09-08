import type { SupabaseClient } from "@supabase/supabase-js";
import { inspectError, isAuthFailure, logDevError } from "@/lib/errors/inspect";
import { rpcComplete } from "@/lib/supabase/rpc";
import type { RpcMutationResult } from "@/lib/progress/types";

export class AuthExpiredError extends Error {
  code = "AUTH_EXPIRED";
  status = 401;
  constructor() {
    super("로그인 시간이 만료되었습니다.");
    this.name = "AuthExpiredError";
  }
}

async function refreshSessionOnce(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) {
    logDevError("refreshSession", error);
    return false;
  }
  return Boolean(data.session);
}

export async function completePrayerRequest(
  supabase: SupabaseClient,
  prayerItemId: string,
  clientEventId: string,
): Promise<RpcMutationResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    const refreshed = await refreshSessionOnce(supabase);
    if (!refreshed) throw new AuthExpiredError();
  }

  try {
    return await rpcComplete(supabase, prayerItemId, clientEventId);
  } catch (error) {
    logDevError("complete_prayer", error);
    if (!isAuthFailure(error) && inspectError(error).status !== 401) throw error;
    const refreshed = await refreshSessionOnce(supabase);
    if (!refreshed) throw new AuthExpiredError();
    return await rpcComplete(supabase, prayerItemId, clientEventId);
  }
}
