"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { AUTH_MESSAGES, MAIL_COOLDOWN_SECONDS, RESET_COOLDOWN_STORAGE_KEY } from "@/lib/auth/messages";
import { hasPublicEnv } from "@/lib/validation/env";

function remainingCooldown(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.sessionStorage.getItem(RESET_COOLDOWN_STORAGE_KEY);
  const until = Number(raw);
  if (!Number.isFinite(until)) return 0;
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

function persistCooldown(seconds: number) {
  window.sessionStorage.setItem(RESET_COOLDOWN_STORAGE_KEY, String(Date.now() + seconds * 1000));
}

export function ForgotPasswordForm() {
  const search = useSearchParams();
  const [email, setEmail] = useState(search.get("email") ?? "");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const configured = useMemo(() => hasPublicEnv(), []);
  const inflight = useRef(false);

  useEffect(() => {
    setCooldown(remainingCooldown());
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function requestReset() {
    if (inflight.current || pending || cooldown > 0) return;
    inflight.current = true;
    setError(null);
    if (!configured) {
      inflight.current = false;
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
      const payload = (await response.json().catch(() => null)) as { error?: string; retryAfter?: number } | null;
      if (response.status === 429) {
        const wait = payload?.retryAfter && payload.retryAfter > 0 ? payload.retryAfter : MAIL_COOLDOWN_SECONDS;
        persistCooldown(wait);
        setCooldown(wait);
        setSent(true);
        setError(payload?.error || AUTH_MESSAGES.rateLimit);
        return;
      }
      if (!response.ok) {
        setError(payload?.error || AUTH_MESSAGES.network);
        return;
      }
      persistCooldown(MAIL_COOLDOWN_SECONDS);
      setSent(true);
      setCooldown(MAIL_COOLDOWN_SECONDS);
    } catch {
      setError(AUTH_MESSAGES.network);
    } finally {
      inflight.current = false;
      setPending(false);
    }
  }

  if (sent) {
    return (
      <AuthShell title="비밀번호 재설정" description={AUTH_MESSAGES.resetSent}>
        {error ? (
          <p className="mb-4 whitespace-pre-line" role="alert">
            {error}
          </p>
        ) : null}
        <div className="space-y-3">
          <Button type="button" className="w-full" disabled={pending || cooldown > 0} onClick={() => void requestReset()}>
            {cooldown > 0 ? AUTH_MESSAGES.cooldown(cooldown) : "재설정 메일 다시 보내기"}
          </Button>
          <Link href="/login" className="touch-target inline-flex w-full items-center justify-center rounded-xl border border-[var(--border)] px-4">
            로그인으로 돌아가기
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="비밀번호 재설정" description="가입할 때 사용한 이메일을 입력해 주세요.">
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
            disabled={pending}
            onChange={(event) => setEmail(event.target.value)}
            className="touch-target w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3"
          />
        </label>
        {error ? (
          <p className="whitespace-pre-line" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending || cooldown > 0}>
          {pending ? "처리 중..." : cooldown > 0 ? AUTH_MESSAGES.cooldown(cooldown) : "재설정 링크 보내기"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-[var(--muted)]">
        <Link href="/login" className="underline">
          로그인으로 돌아가기
        </Link>
      </p>
    </AuthShell>
  );
}
