import { passwordResetCallbackUrl, safeNextPath, siteUrlFromRequest } from "@/lib/auth/redirect";
import { describe, expect, it } from "vitest";

describe("인증 리다이렉트", () => {
  it("상대 경로만 허용한다", () => {
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
    expect(safeNextPath("/login")).toBe("/login");
    expect(safeNextPath("https://evil.example/phish")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });

  it("비밀번호 재설정 콜백 URL을 만든다", () => {
    expect(passwordResetCallbackUrl("https://prayer-book-chi.vercel.app")).toBe(
      "https://prayer-book-chi.vercel.app/auth/callback?next=/reset-password",
    );
    expect(passwordResetCallbackUrl("http://localhost:3000/")).toBe(
      "http://localhost:3000/auth/callback?next=/reset-password",
    );
  });

  it("요청 Origin이 허용되면 그 주소를 쓴다", () => {
    const request = new Request("https://prayer-book-chi.vercel.app/api/auth/reset", {
      method: "POST",
      headers: { origin: "https://prayer-book-chi.vercel.app" },
    });
    expect(siteUrlFromRequest(request, "http://localhost:3000")).toBe("https://prayer-book-chi.vercel.app");
  });

  it("허용되지 않은 Origin은 사이트 URL로 되돌린다", () => {
    const request = new Request("https://prayer-book-chi.vercel.app/api/auth/reset", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    expect(siteUrlFromRequest(request, "https://prayer-book-chi.vercel.app")).toBe(
      "https://prayer-book-chi.vercel.app",
    );
  });
});
