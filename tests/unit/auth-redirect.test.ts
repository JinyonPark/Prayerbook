import { describe, expect, it } from "vitest";
import { passwordResetCallbackUrl, safeNextPath } from "@/lib/auth/redirect";

describe("인증 리다이렉트", () => {
  it("상대 경로만 허용한다", () => {
    expect(safeNextPath("/auth/update-password")).toBe("/auth/update-password");
    expect(safeNextPath("/login")).toBe("/login");
    expect(safeNextPath("https://evil.example/phish")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });

  it("비밀번호 재설정 콜백 URL을 만든다", () => {
    expect(passwordResetCallbackUrl("https://prayer-book-chi.vercel.app")).toBe(
      "https://prayer-book-chi.vercel.app/auth/callback?next=/auth/update-password",
    );
    expect(passwordResetCallbackUrl("http://localhost:3000/")).toBe(
      "http://localhost:3000/auth/callback?next=/auth/update-password",
    );
  });
});
