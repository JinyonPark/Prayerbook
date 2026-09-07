"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { AUTH_MESSAGES, MAIL_COOLDOWN_SECONDS } from "@/lib/auth/messages";
import { hasPublicEnv } from "@/lib/validation/env";

export function ForgotPasswordForm() {
  const search = useSearchParams();
  const [email, setEmail] = useState(search.get("email") ?? "");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const configured = useMemo(() => hasPublicEnv(), []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function requestReset() {
    if (pending || cooldown > 0) return;
    setError(null);
    if (!configured) {
      setError(AUTH_MESSAGES.configMissing);
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (response.status === 429) {
        setCooldown(MAIL_COOLDOWN_SECONDS);
        setSent(true);
        return;
      }
      if (!response.ok) {
        setError(payload?.error || AUTH_MESSAGES.network);
        return;
      }
      setSent(true);
      setCooldown(MAIL_COOLDOWN_SECONDS);
    } catch {
      setError(AUTH_MESSAGES.network);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    const signupHref = `/signup${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""}`;
    return (
      <AuthShell title="비밀번호 재설정" description={AUTH_MESSAGES.resetSent}>
        <p className="mb-4 text-sm text-[var(--muted)]">{AUTH_MESSAGES.otherEmail}</p>
        {error ? (
          <p className="mb-4 whitespace-pre-line" role="alert">
            {error}
          </p>
        ) : null}
        <div className="space-y-3">
          <Button type="button" className="w-full" disabled={pending || cooldown > 0} onClick={() => void requestReset()}>
            {cooldown > 0 ? AUTH_MESSAGES.cooldown(cooldown) : "메일 다시 보내기"}
          </Button>
          <Link href={signupHref} className="touch-target inline-flex w-full items-center justify-center rounded-xl border border-[var(--border)] px-4">
            회원가입
          </Link>
          <Link href="/login" className="touch-target inline-flex w-full items-center justify-center rounded-xl border border-[var(--border)] px-4">
            로그인으로 돌아가기
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="비밀번호 재설정" description="가입한 이메일로 재설정 링크를 보냅니다.">
      <form
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void requestReset();
        }}
      >
        <label className="block" htmlFor="reset-email">
          <span className="mb-1 block text-sm">이메일</span>
          <input
            id="reset-email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="touch-target w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3"
          />
        </label>
        {error ? (
          <p className="whitespace-pre-line" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "처리 중..." : "재설정 링크 보내기"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-[var(--muted)]">
        <Link href="/signup" className="underline">
          회원가입
        </Link>
        {" · "}
        <Link href="/login" className="underline">
          로그인으로 돌아가기
        </Link>
      </p>
    </AuthShell>
  );
}
