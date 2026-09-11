import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { copyTextToClipboard, isAbortError } from "@/lib/progress/clipboard";
import {
  APP_SHARE_COPY_FAILURE,
  APP_SHARE_COPY_SUCCESS,
  APP_SHARE_TEXT,
  APP_SHARE_TITLE,
  APP_SHARE_URL,
  copyPrayerBookUrl,
  prayerBookShareData,
  sharePrayerBookApp,
} from "@/lib/share-app";

describe("기도훈련집 앱 Web Share 및 Clipboard", () => {
  const originalClipboard = navigator.clipboard;
  const originalShare = navigator.share;
  const originalCanShare = navigator.canShare;
  const originalExec = document.execCommand;

  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: originalClipboard });
    Object.defineProperty(navigator, "share", { configurable: true, value: originalShare });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: originalCanShare });
    document.execCommand = originalExec;
    vi.restoreAllMocks();
  });

  it("Web Share API에 title, text, url만 전달한다", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    await expect(sharePrayerBookApp()).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({
      title: APP_SHARE_TITLE,
      text: APP_SHARE_TEXT,
      url: APP_SHARE_URL,
    });
    expect(share.mock.calls[0][0]).toEqual(prayerBookShareData());
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it("사용자가 공유를 취소하면 오류로 처리하지 않고 복사하지 않는다", async () => {
    const abort = new DOMException("The user aborted a request.", "AbortError");
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: vi.fn().mockRejectedValue(abort),
    });
    await expect(sharePrayerBookApp()).resolves.toBe("cancelled");
    expect(isAbortError(abort)).toBe(true);
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it("Web Share 미지원이면 운영 URL만 복사한다", async () => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    await expect(sharePrayerBookApp()).resolves.toBe("copied");
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://prayer-book-chi.vercel.app/");
  });

  it("카카오톡 인앱처럼 share가 실패해도 링크 복사 fallback을 사용한다", async () => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error("not allowed")),
    });
    await expect(sharePrayerBookApp()).resolves.toBe("copied");
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(APP_SHARE_URL);
  });

  it("링크 복사는 운영 URL만 넣고 성공·실패 문구가 개인정보를 담지 않는다", async () => {
    await expect(copyPrayerBookUrl()).resolves.toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(APP_SHARE_URL);
    expect(APP_SHARE_COPY_SUCCESS).toBe("링크가 복사되었습니다.");
    expect(APP_SHARE_COPY_FAILURE).toContain("링크를 복사하지 못했습니다.");
    expect(APP_SHARE_COPY_SUCCESS).not.toContain("공유가 완료");
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error("denied"));
    document.execCommand = vi.fn().mockReturnValue(true);
    await expect(copyTextToClipboard(APP_SHARE_URL)).resolves.toBe(true);
  });
});
