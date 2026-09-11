"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/Button";
import { AUTH_MESSAGES } from "@/lib/auth/messages";
import { parseMatchingEmails } from "@/lib/auth/email";
import { MIN_NEW_PASSWORD_LENGTH, validateNewPassword } from "@/lib/auth/password";
import { hasPublicEnv } from "@/lib/validation/env";

type AuthPayload = { error?: string; retryAfter?: number; code?: string; email?: string };

export function SignupForm() {
  const router = useRouter();
  const search = useSearchParams();
  const inflight = useRef(false);
  const [email, setEmail] = useState(search.get("email") ?? "");
  const [confirmEmail, setConfirmEmail] = useState(search.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [doneEmail, setDoneEmail] = useState<string | null>(null);
  const configured = useMemo(() => hasPublicEnv(), []);

  useEffect(() => {
    if (!doneEmail) return;
    const timer = window.setTimeout(() => {
      router.replace("/");
      router.refresh();
    }, 900);
    return () => window.clearTimeout(timer);
  }, [doneEmail, router]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (inflight.current || pending || doneEmail) return;
    inflight.current = true;
    setError(null);
    setDuplicate(false);
    if (!configured) {
      inflight.current = false;
      setError(AUTH_MESSAGES.configMissing);
      return;
    }
    const emails = parseMatchingEmails(email, confirmEmail);
    if ("error" in emails) {
      inflight.current = false;
      setError(emails.error);
      return;
    }
    const passwordError = validateNewPassword(password, confirmPassword, "signup");
    if (passwordError) {
      inflight.current = false;
      setError(passwordError);
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emails.email,
          confirmEmail: emails.email,
          password,
          confirmPassword,
        }),
      });
      const payload = (await response.json().catch(() => null)) as AuthPayload | null;
      if (response.status === 409 || payload?.code === "already_registered") {
        setDuplicate(true);
        setError(payload?.error || AUTH_MESSAGES.alreadyRegistered);
        return;
      }
      if (response.status === 429) {
        setError(payload?.error || AUTH_MESSAGES.rateLimit);
        return;
      }
      if (!response.ok) {
        setError(payload?.error || AUTH_MESSAGES.signupFailed);
        return;
      }
      setPassword("");
      setConfirmPassword("");
      setDoneEmail(payload?.email || emails.email);
    } catch {
      setError(AUTH_MESSAGES.network);
    } finally {
      inflight.current = false;
      setPending(false);
    }
  }

  if (doneEmail) {
    return (
      <AuthShell title="회원가입" description={AUTH_MESSAGES.signupComplete}>
        <p className="whitespace-pre-line text-sm text-[var(--muted)]">{AUTH_MESSAGES.signupEmailUsed(doneEmail)}</p>
      </AuthShell>
    );
  }

  const forgotHref = `/forgot-password${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""}`;

  return (
    <AuthShell title="회원가입" description="이메일 인증 없이 바로 시작할 수 있습니다.">
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
            disabled={pending}
            onChange={(event) => setEmail(event.target.value)}
            className="touch-target w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3"
          />
        </label>
        <label className="block" htmlFor="signup-email-confirm">
          <span className="mb-1 block text-sm">이메일 확인</span>
          <input
            id="signup-email-confirm"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={confirmEmail}
            disabled={pending}
            onChange={(event) => setConfirmEmail(event.target.value)}
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
        <p className="whitespace-pre-line text-sm text-[var(--muted)]">{AUTH_MESSAGES.signupHint}</p>
        {error ? (
          <p className="whitespace-pre-line" role="alert">
            {error}
          </p>
        ) : null}
        {duplicate ? (
          <div className="space-y-3">
            <Link href="/login" className="touch-target inline-flex w-full items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-[var(--accent-text)]">
              로그인
            </Link>
            <Link href={forgotHref} className="touch-target inline-flex w-full items-center justify-center rounded-xl border border-[var(--border)] px-4">
              비밀번호 재설정
            </Link>
          </div>
        ) : (
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "처리 중..." : "회원가입"}
          </Button>
        )}
      </form>
      <p className="mt-4 text-sm text-[var(--muted)]">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="underline">
          로그인
        </Link>
      </p>
    </AuthShell>
  );
}
