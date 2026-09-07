"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/Button";
import { AUTH_MESSAGES, MAIL_COOLDOWN_SECONDS } from "@/lib/auth/messages";
import { MIN_NEW_PASSWORD_LENGTH, validateNewPassword } from "@/lib/auth/password";
import { hasPublicEnv } from "@/lib/validation/env";

export function SignupForm() {
  const search = useSearchParams();
  const [email, setEmail] = useState(search.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const configured = useMemo(() => hasPublicEnv(), []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    if (!configured) {
      setError(AUTH_MESSAGES.configMissing);
      return;
    }
    const passwordError = validateNewPassword(password, confirmPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, confirmPassword }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(payload?.error || AUTH_MESSAGES.network);
        return;
      }
      setPassword("");
      setConfirmPassword("");
      setCheckEmail(true);
      setResendCooldown(MAIL_COOLDOWN_SECONDS);
    } catch {
      setError(AUTH_MESSAGES.network);
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    if (resendCooldown > 0 || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (response.status === 429) {
        setResendCooldown(MAIL_COOLDOWN_SECONDS);
        setError(payload?.error || AUTH_MESSAGES.rateLimit);
        return;
      }
      setResendCooldown(MAIL_COOLDOWN_SECONDS);
    } catch {
      setError(AUTH_MESSAGES.network);
    } finally {
      setPending(false);
    }
  }

  if (checkEmail) {
    return (
      <AuthShell title="이메일 인증" description={AUTH_MESSAGES.signupCheckEmail}>
        {error ? (
          <p className="mb-4 whitespace-pre-line" role="alert">
            {error}
          </p>
        ) : null}
        <div className="space-y-3">
          <Button type="button" className="w-full" disabled={pending || resendCooldown > 0} onClick={() => void resend()}>
            {resendCooldown > 0 ? AUTH_MESSAGES.cooldown(resendCooldown) : "인증 메일 재전송"}
          </Button>
          <Link href="/login" className="touch-target inline-flex w-full items-center justify-center rounded-xl border border-[var(--border)] px-4">
            로그인으로 돌아가기
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="회원가입" description="이메일 인증 후 로그인할 수 있습니다.">
      <form className="space-y-4" noValidate onSubmit={(event) => void onSubmit(event)}>
        <label className="block" htmlFor="signup-email">
          <span className="mb-1 block text-sm">이메일</span>
          <input
            id="signup-email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="touch-target w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3"
          />
        </label>
        <PasswordField
          id="signup-password"
          label="비밀번호"
          value={password}
          autoComplete="new-password"
          minLength={MIN_NEW_PASSWORD_LENGTH}
          visible={visible}
          onVisibleChange={setVisible}
          onChange={setPassword}
          disabled={pending}
        />
        <PasswordField
          id="signup-confirm"
          label="비밀번호 확인"
          value={confirmPassword}
          autoComplete="new-password"
          minLength={MIN_NEW_PASSWORD_LENGTH}
          visible={visible}
          onVisibleChange={setVisible}
          onChange={setConfirmPassword}
          disabled={pending}
        />
        <p className="text-sm text-[var(--muted)]">비밀번호는 최소 8자 이상 입력해 주세요.</p>
        {error ? (
          <p className="whitespace-pre-line" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "처리 중..." : "회원가입"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-[var(--muted)]">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="underline">
          로그인으로 돌아가기
        </Link>
      </p>
    </AuthShell>
  );
}
