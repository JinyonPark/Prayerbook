import { inspectError, isAuthFailure } from "@/lib/errors/inspect";
import type { RpcMutationResult } from "@/lib/progress/types";

export type ProgressMutation =
  | { op: "set_count"; prayerItemId: string; newCount: number; clientEventId: string }
  | { op: "reset_item"; prayerItemId: string; clientEventId: string }
  | { op: "reset_round"; clientEventId: string }
  | { op: "reset_main"; clientEventId: string }
  | { op: "reset_all"; clientEventId: string }
  | { op: "bulk_set"; newCount: number; clientEventId: string };

class ProgressMutationError extends Error {
  code: string;
  status: number;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ProgressMutationError";
    this.status = status;
    this.code = code;
  }
}

export async function mutateProgress(payload: ProgressMutation): Promise<RpcMutationResult> {
  const response = await fetch("/api/progress", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  } & RpcMutationResult;
  if (!response.ok) {
    throw new ProgressMutationError(
      body.message || body.error || "COMPLETE_FAILED",
      response.status,
      body.error || "COMPLETE_FAILED",
    );
  }
  return body;
}

export function isProgressMutationError(error: unknown): boolean {
  return inspectError(error).name === "ProgressMutationError" || isAuthFailure(error);
}
