"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/Button";
import { AUTH_MESSAGES } from "@/lib/auth/messages";
import { MIN_LOGIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { safeNextPath } from "@/lib/auth/redirect";
import { hasPublicEnv } from "@/lib/validation/env";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const nextPath = safeNextPath(search.get("next"));
  const [email, setEmail] = useState(search.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = useMemo(() => hasPublicEnv(), []);
  const resetDone = search.get("reset") === "success";
  const inflight = useRef(false);

  useEffect(() => {
    const mode = search.get("mode");
    if (mode === "signup") router.replace("/signup");
    if (mode === "reset") router.replace("/forgot-password");
    if (mode === "update") router.replace("/reset-password");
  }, [router, search]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (inflight.current || pending) return;
    inflight.current = true;
    setError(null);
    if (!configured) {
      inflight.current = false;
      setError(AUTH_MESSAGES.configMissing);
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email.trim(), email: email.trim(), password }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; code?: string } | null;
      if (response.status === 403 && payload?.code === "unconfirmed") {
        setError(payload.error || AUTH_MESSAGES.unconfirmed);
        return;
      }
      if (!response.ok) {
        setError(payload?.error || AUTH_MESSAGES.loginFailed);
        return;
      }
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError(AUTH_MESSAGES.network);
    } finally {
      inflight.current = false;
      setPending(false);
    }
  }

  return (
    <AuthShell description="계정으로 기도 기록을 모든 기기에서 이어갑니다.">
      {search.get("error") === "config" ? (
        <p className="mb-4 rounded-xl bg-[var(--card)] p-3 text-sm">{AUTH_MESSAGES.configMissing}</p>
      ) : null}
      {resetDone ? (
        <p className="mb-4 rounded-xl bg-[var(--card)] p-3 text-sm whitespace-pre-line" role="status">
          {AUTH_MESSAGES.passwordChanged}
        </p>
      ) : null}
      <form className="space-y-4" noValidate onSubmit={(event) => void onSubmit(event)}>
        <label className="block" htmlFor="login-email">
          <span className="mb-1 block text-sm">이메일</span>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="username"
            inputMode="email"
            value={email}
            disabled={pending}
            onChange={(event) => setEmail(event.target.value)}
            className="touch-target w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3"
          />
        </label>
        <PasswordField
          id="login-password"
          label="비밀번호"
          value={password}
          autoComplete="current-password"
          minLength={MIN_LOGIN_PASSWORD_LENGTH}
          visible={visible}
          onVisibleChange={setVisible}
          onChange={setPassword}
          disabled={pending}
        />
        {error ? (
          <p className="whitespace-pre-line" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "로그인 중..." : "로그인"}
        </Button>
      </form>
      <p className="mt-4">
        <Link href={`/forgot-password${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""}`} className="text-sm underline">
          비밀번호를 잊으셨나요?
        </Link>
      </p>
      <p className="mt-3 text-sm text-[var(--muted)]">
        계정이 없으신가요?{" "}
        <Link href="/signup" className="underline">
          회원가입
        </Link>
      </p>
    </AuthShell>
  );
}
