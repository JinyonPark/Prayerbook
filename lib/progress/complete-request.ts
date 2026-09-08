import type { SupabaseClient } from "@supabase/supabase-js";
import { inspectError, isAuthFailure, logDevError } from "@/lib/errors/inspect";
import { rpcComplete } from "@/lib/supabase/rpc";
import type { RpcMutationResult } from "@/lib/progress/types";
import { perfMark, perfMeasure } from "@/lib/perf/marks";

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
  perfMark("complete_request_start");
  try {
    const result = await rpcComplete(supabase, prayerItemId, clientEventId);
    perfMark("complete_response_received");
    perfMeasure("complete_rpc", "complete_request_start", "complete_response_received");
    return result;
  } catch (error) {
    logDevError("complete_prayer", error);
    if (isAuthFailure(error) || inspectError(error).status === 401) {
      const refreshed = await refreshSessionOnce(supabase);
      if (!refreshed) throw new AuthExpiredError();
      try {
        const result = await rpcComplete(supabase, prayerItemId, clientEventId);
        perfMark("complete_response_received");
        perfMeasure("complete_rpc", "complete_request_start", "complete_response_received");
        return result;
      } catch (retryError) {
        if (isAuthFailure(retryError) || inspectError(retryError).status === 401) {
          throw new AuthExpiredError();
        }
        if (typeof window !== "undefined") {
          try {
            return await completeViaSameOrigin(prayerItemId, clientEventId);
          } catch (apiError) {
            if (isAuthFailure(apiError) || inspectError(retryError).status === 401) {
              throw new AuthExpiredError();
            }
            throw apiError;
          }
        }
        throw retryError;
      }
    }
    if (typeof window !== "undefined") {
      try {
        const result = await completeViaSameOrigin(prayerItemId, clientEventId);
        perfMark("complete_response_received");
        perfMeasure("complete_rpc", "complete_request_start", "complete_response_received");
        return result;
      } catch (apiError) {
        logDevError("complete_prayer_api", apiError);
        if (isAuthFailure(apiError) || inspectError(apiError).status === 401) {
          const refreshed = await refreshSessionOnce(supabase);
          if (!refreshed) throw new AuthExpiredError();
          return await rpcComplete(supabase, prayerItemId, clientEventId);
        }
        throw apiError;
      }
    }
    throw error;
  }
}
