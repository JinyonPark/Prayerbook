import { describe, expect, it } from "vitest";
import { validateNewPassword } from "@/lib/auth/password";
import { parseEmailInput } from "@/lib/auth/email";
import { isAuthPublicPath, passwordResetCallbackUrl, safeNextPath, signupConfirmCallbackUrl } from "@/lib/auth/redirect";

describe("새 비밀번호 검증", () => {
  it("짧거나 다른 확인 값을 거절한다", () => {
    expect(validateNewPassword("short", "short")).toBe("비밀번호는 최소 8자 이상 입력해 주세요.");
    expect(validateNewPassword("long-enough", "different")).toBe("새 비밀번호와 비밀번호 확인이 일치하지 않습니다.");
    expect(validateNewPassword("long-enough", "different", "signup")).toBe("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
    expect(validateNewPassword("long-enough", "long-enough")).toBeNull();
  });
});

describe("이메일 입력", () => {
  it("앞뒤 공백을 제거하고 소문자로 만든다", () => {
    expect(parseEmailInput("  Jin@Example.com ")).toEqual({ email: "jin@example.com" });
    expect(parseEmailInput("")).toEqual({ error: "이메일을 입력해 주세요." });
    expect(parseEmailInput("not-an-email")).toEqual({ error: "올바른 이메일 주소를 입력해 주세요." });
  });
});

describe("인증 공개 경로와 콜백", () => {
  it("인증 페이지만 공개로 본다", () => {
    expect(isAuthPublicPath("/login")).toBe(true);
    expect(isAuthPublicPath("/signup")).toBe(true);
    expect(isAuthPublicPath("/forgot-password")).toBe(true);
    expect(isAuthPublicPath("/reset-password")).toBe(true);
    expect(isAuthPublicPath("/auth/error")).toBe(true);
    expect(isAuthPublicPath("/api/auth/reset")).toBe(true);
    expect(isAuthPublicPath("/api/health")).toBe(true);
    expect(isAuthPublicPath("/settings")).toBe(false);
    expect(isAuthPublicPath("/")).toBe(false);
  });

  it("비밀번호 재설정 콜백은 reset-password로 보낸다", () => {
    expect(passwordResetCallbackUrl("https://prayer-book-chi.vercel.app")).toBe(
      "https://prayer-book-chi.vercel.app/auth/callback?next=/reset-password",
    );
    expect(signupConfirmCallbackUrl("http://localhost:3000/")).toBe(
      "http://localhost:3000/auth/callback?next=/login",
    );
  });

  it("next open redirect를 막는다", () => {
    expect(safeNextPath("/settings")).toBe("/settings");
    expect(safeNextPath("/prayers/3")).toBe("/prayers/3");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
    expect(safeNextPath("/login")).toBe("/login");
  });
});
