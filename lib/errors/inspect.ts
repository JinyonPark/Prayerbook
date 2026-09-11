export type InspectedError = {
  message: string;
  code: string;
  status: number | null;
  name: string;
};

function readStatus(error: object): number | null {
  const record = error as {
    status?: unknown;
    statusCode?: unknown;
    context?: { status?: unknown };
  };
  const raw = record.status ?? record.statusCode ?? record.context?.status;
  const status = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(status) && status > 0 ? status : null;
}

export function inspectError(error: unknown): InspectedError {
  if (error instanceof Error) {
    const extra = error as Error & { code?: unknown };
    return {
      message: error.message,
      code: extra.code != null ? String(extra.code) : "",
      status: readStatus(error),
      name: error.name,
    };
  }
  if (typeof error === "object" && error) {
    const record = error as { message?: unknown; code?: unknown; name?: unknown };
    return {
      message: record.message != null ? String(record.message) : "",
      code: record.code != null ? String(record.code) : "",
      status: readStatus(error),
      name: record.name != null ? String(record.name) : "",
    };
  }
  return {
    message: String(error),
    code: "",
    status: null,
    name: "",
  };
}

export function isNetworkFailure(error: unknown): boolean {
  const info = inspectError(error);
  if (info.status && info.status > 0) return false;
  const haystack = `${info.name} ${info.message} ${info.code}`;
  if (/failed to fetch/i.test(haystack)) return true;
  if (/networkerror/i.test(haystack)) return true;
  if (/network request failed/i.test(haystack)) return true;
  if (/load failed/i.test(haystack)) return true;
  if (/err_internet_offline|err_network_changed|err_connection|err_name_not_resolved/i.test(haystack)) return true;
  if (info.name === "AuthRetryableFetchError" || info.name === "FunctionsFetchError") return true;
  if (info.name === "AbortError" && !info.status) return true;
  if (info.name === "TypeError" && /fetch/i.test(info.message) && /failed/i.test(info.message)) return true;
  return false;
}

export function isAuthFailure(error: unknown): boolean {
  const info = inspectError(error);
  if (info.status === 401 || info.status === 403) return true;
  const haystack = `${info.code} ${info.message}`.toLowerCase();
  return (
    haystack.includes("not_authenticated") ||
    haystack.includes("jwt expired") ||
    haystack.includes("jwt") && haystack.includes("expired") ||
    haystack.includes("pgrst301") ||
    haystack.includes("invalid jwt") ||
    (haystack.includes("session") && haystack.includes("expired")) ||
    info.code === "28000"
  );
}

export function isNotFoundFailure(error: unknown): boolean {
  const info = inspectError(error);
  const haystack = `${info.code} ${info.message}`;
  return haystack.includes("PRAYER_NOT_FOUND") || haystack.includes("P0002") || info.status === 404;
}

export function parseAuthRetryAfterSeconds(error: unknown): number | null {
  const info = inspectError(error);
  const match = info.message.match(/after\s+(\d+)\s+seconds/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds < 1) return null;
  return Math.min(Math.round(seconds), 3600);
}

export function isRateLimitFailure(error: unknown): boolean {
  const info = inspectError(error);
  const haystack = `${info.code} ${info.message}`.toLowerCase();
  return (
    info.status === 429 ||
    haystack.includes("over_email_send_rate_limit") ||
    haystack.includes("over_request_rate_limit") ||
    haystack.includes("email rate limit") ||
    haystack.includes("too many") ||
    haystack.includes("for security purposes")
  );
}

export function logDevError(where: string, error: unknown) {
  if (process.env.NODE_ENV !== "development") return;
  logAuthError(where, error);
}

export function logAuthError(where: string, error: unknown) {
  const info = inspectError(error);
  console.warn(`[prayerbook:${where}]`, {
    code: info.code,
    status: info.status,
    message: info.message.slice(0, 200),
  });
}
