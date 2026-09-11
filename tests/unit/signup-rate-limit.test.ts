import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseMatchingEmails } from "@/lib/auth/email";
import { mapSignupAuthError, missingSignupSession } from "@/lib/auth/gotrue-error";
import { AUTH_MESSAGES } from "@/lib/auth/messages";

describe("회원가입 인증 오류", () => {
  it("이미 가입된 이메일은 409로 구분한다", () => {
    expect(mapSignupAuthError({ message: "User already registered", code: "email_exists" })).toEqual({
      status: 409,
      error: AUTH_MESSAGES.alreadyRegistered,
      code: "already_registered",
    });
  });

  it("예상치 못한 가입 메일 발송은 설정 불일치로 본다", () => {
    expect(
      mapSignupAuthError({
        message: "email rate limit exceeded",
        code: "over_email_send_rate_limit",
        status: 429,
      }),
    ).toEqual({
      status: 503,
      error: AUTH_MESSAGES.signupFailed,
      code: "email_send_unexpected",
    });
  });

  it("가입 비활성화와 Email Provider 비활성화를 구분한다", () => {
    expect(mapSignupAuthError({ code: "signup_disabled", message: "Signups not allowed" })).toMatchObject({
      status: 403,
      code: "signup_disabled",
    });
    expect(mapSignupAuthError({ code: "email_provider_disabled", message: "Email logins are disabled" })).toMatchObject({
      status: 403,
      code: "email_provider_disabled",
    });
  });
});

describe("회원가입 이메일 확인", () => {
  it("session이 없으면 인증 안내로 보내지 않는다", () => {
    expect(missingSignupSession()).toEqual({
      status: 503,
      error: AUTH_MESSAGES.signupSessionFailed,
      code: "no_session",
    });
  });

  it("이메일과 이메일 확인이 다르면 요청하지 않는다", () => {
    expect(parseMatchingEmails("a@example.com", "b@example.com")).toEqual({
      error: AUTH_MESSAGES.emailMismatch,
    });
    expect(parseMatchingEmails("  A@Example.com ", "a@example.com")).toEqual({
      email: "a@example.com",
    });
  });
});

describe("회원가입 API와 폼", () => {
  it("가입 시 확인 메일을 보내지 않고 세션을 만든다", () => {
    const source = readFileSync(path.join(process.cwd(), "app/api/auth/register/route.ts"), "utf8");
    expect(source).toContain("admin.auth.admin.createUser");
    expect(source).toContain("email_confirm: true");
    expect(source).toContain("signInWithPassword");
    expect(source).not.toContain("signUp");
    expect(source).not.toContain("emailRedirectTo");
    expect(source).not.toContain("signOut");
    expect(source).not.toContain("auth.resend");
  });

  it("회원가입 폼은 인증 메일 화면과 resend를 쓰지 않는다", () => {
    const source = readFileSync(path.join(process.cwd(), "components/auth/SignupForm.tsx"), "utf8");
    expect(source).toContain("이메일 확인");
    expect(source).toContain("inflight.current");
    expect(source).toContain('router.replace("/")');
    expect(source).not.toContain("/api/auth/resend");
    expect(source).not.toContain("인증 메일 재전송");
    expect(source).not.toContain("signupCheckEmail");
  });

  it("인증 메일 재전송 API는 더 이상 메일을 보내지 않는다", () => {
    const source = readFileSync(path.join(process.cwd(), "app/api/auth/resend/route.ts"), "utf8");
    expect(source).toContain("410");
    expect(source).not.toContain("auth.resend");
  });
});
