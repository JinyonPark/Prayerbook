import { describe, expect, it, vi } from "vitest";
import { toCompleteUserMessage, toUserMessage, NETWORK_USER_MESSAGE, AUTH_EXPIRED_USER_MESSAGE, COMPLETE_SAVE_FAILED_MESSAGE, SERVER_UNAVAILABLE_USER_MESSAGE } from "@/lib/errors/user-message";
import { isNetworkFailure } from "@/lib/errors/inspect";
import { completePrayerRequest, AuthExpiredError } from "@/lib/progress/complete-request";

describe("완료 오류 메시지", () => {
  it("실제 네트워크 실패만 연결 안내로 표시한다", () => {
    expect(toCompleteUserMessage(new TypeError("Failed to fetch"))).toBe(NETWORK_USER_MESSAGE);
    expect(toCompleteUserMessage({ name: "AuthRetryableFetchError", message: "Failed to fetch" })).toBe(NETWORK_USER_MESSAGE);
    expect(isNetworkFailure({ message: "Could not find the function public.complete_prayer in the schema cache" })).toBe(false);
    expect(toCompleteUserMessage({ message: "Could not find the function public.complete_prayer in the schema cache", code: "PGRST202" })).toBe(
      COMPLETE_SAVE_FAILED_MESSAGE,
    );
  });

  it("401은 로그인 만료로 표시한다", () => {
    expect(toCompleteUserMessage({ message: "JWT expired", status: 401 })).toBe(AUTH_EXPIRED_USER_MESSAGE);
    expect(toCompleteUserMessage(new AuthExpiredError())).toBe(AUTH_EXPIRED_USER_MESSAGE);
  });

  it("RLS 오류는 인터넷 오류가 아니라 저장 실패로 표시한다", () => {
    expect(toCompleteUserMessage({ message: "permission denied for table user_prayer_progress", code: "42501" })).toBe(
      COMPLETE_SAVE_FAILED_MESSAGE,
    );
  });

  it("fetch라는 단어만 있는 서버 오류는 인터넷 오류가 아니다", () => {
    expect(isNetworkFailure({ message: "Could not fetch row from cache" })).toBe(false);
    expect(toUserMessage({ message: "Could not fetch row from cache", code: "PGRST116" })).not.toBe(NETWORK_USER_MESSAGE);
  });

  it("서버 환경 오류는 서버 연결 안내로 표시한다", () => {
    expect(toCompleteUserMessage({ message: "SERVER_UNAVAILABLE", status: 503, code: "SERVER_UNAVAILABLE" })).toBe(
      SERVER_UNAVAILABLE_USER_MESSAGE,
    );
  });
});

describe("완료 요청", () => {
  it("정상 세션에서 RPC를 호출한다", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { current_total: 1, idempotent: false }, error: null });
    const supabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "t" } }, error: null }),
        refreshSession: vi.fn(),
      },
      rpc,
    };
    const result = await completePrayerRequest(supabase as never, "prayer-1", "event-1");
    expect(rpc).toHaveBeenCalledWith("complete_prayer", { prayer_item_id: "prayer-1", client_event_id: "event-1" });
    expect(result.current_total).toBe(1);
  });

  it("navigator.onLine이 false여도 요청을 보낸다", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const rpc = vi.fn().mockResolvedValue({ data: { current_total: 2, idempotent: false }, error: null });
    const supabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "t" } }, error: null }),
        refreshSession: vi.fn(),
      },
      rpc,
    };
    await completePrayerRequest(supabase as never, "prayer-1", "event-1");
    expect(rpc).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("인증 만료 후 세션 갱신이 되면 같은 client_event_id로 한 번만 재시도한다", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: "JWT expired", status: 401 } })
      .mockResolvedValueOnce({ data: { current_total: 3, idempotent: false }, error: null });
    const supabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "old" } }, error: null }),
        refreshSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "new" } }, error: null }),
      },
      rpc,
    };
    const result = await completePrayerRequest(supabase as never, "prayer-1", "same-event");
    expect(result.current_total).toBe(3);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0]?.[1]).toEqual({ prayer_item_id: "prayer-1", client_event_id: "same-event" });
    expect(rpc.mock.calls[1]?.[1]).toEqual({ prayer_item_id: "prayer-1", client_event_id: "same-event" });
  });

  it("브라우저에서 RPC가 되면 같은 출처 API를 쓰지 않는다", async () => {
    vi.stubGlobal("window", {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const rpc = vi.fn().mockResolvedValue({ data: { current_total: 4, idempotent: false }, error: null });
    const supabase = {
      auth: {
        refreshSession: vi.fn(),
      },
      rpc,
    };
    const result = await completePrayerRequest(supabase as never, "prayer-1", "event-1");
    expect(result.current_total).toBe(4);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("브라우저에서 RPC가 실패하면 같은 출처 API로 저장한다", async () => {
    vi.stubGlobal("window", {});
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ current_total: 5, idempotent: false }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "Failed to fetch" } });
    const supabase = {
      auth: {
        refreshSession: vi.fn(),
      },
      rpc,
    };
    const result = await completePrayerRequest(supabase as never, "prayer-1", "event-1");
    expect(result.current_total).toBe(5);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/prayers/complete",
      expect.objectContaining({ method: "POST" }),
    );
    vi.unstubAllGlobals();
  });
});
