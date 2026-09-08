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

class CompleteRequestError extends Error {
  code: string;
  status: number;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "CompleteRequestError";
    this.status = status;
    this.code = code;
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

export async function completeViaSameOrigin(
  prayerItemId: string,
  clientEventId: string,
): Promise<RpcMutationResult> {
  const response = await fetch("/api/prayers/complete", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prayerItemId, clientEventId }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  } & RpcMutationResult;
  if (!response.ok) {
    throw new CompleteRequestError(
      body.message || body.error || "COMPLETE_FAILED",
      response.status,
      body.error || "COMPLETE_FAILED",
    );
  }
  return body;
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

  if (typeof window !== "undefined") {
    try {
      return await completeViaSameOrigin(prayerItemId, clientEventId);
    } catch (error) {
      logDevError("complete_prayer_api", error);
      if (isAuthFailure(error) || inspectError(error).status === 401) {
        const refreshed = await refreshSessionOnce(supabase);
        if (!refreshed) throw new AuthExpiredError();
        try {
          return await completeViaSameOrigin(prayerItemId, clientEventId);
        } catch (retryError) {
          if (isAuthFailure(retryError) || inspectError(retryError).status === 401) {
            throw new AuthExpiredError();
          }
          logDevError("complete_prayer_api_retry", retryError);
        }
      }
    }
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
