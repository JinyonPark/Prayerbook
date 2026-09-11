"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/Button";
import { AUTH_MESSAGES } from "@/lib/auth/messages";
import { MIN_NEW_PASSWORD_LENGTH, validateNewPassword } from "@/lib/auth/password";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { hasPublicEnv } from "@/lib/validation/env";

type ReadyState = "checking" | "ok" | "missing";

export function ResetPasswordForm() {
  const inflight = useRef(false);
  const [ready, setReady] = useState<ReadyState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const configured = useMemo(() => hasPublicEnv(), []);

  useEffect(() => {
    if (!configured) {
      setReady("missing");
      return;
    }
    let cancelled = false;
    const supabase = createBrowserSupabaseClient();

    async function checkSession() {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      setReady(data.user ? "ok" : "missing");
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady("ok");
      }
    });

    void checkSession();
    const retry = window.setTimeout(() => void checkSession(), 400);
    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        setReady((current) => (current === "checking" ? "missing" : current));
      }
    }, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(retry);
      window.clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, [configured]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (inflight.current || pending) return;
    inflight.current = true;
    setError(null);
    const passwordError = validateNewPassword(password, confirmPassword);
    if (passwordError) {
      inflight.current = false;
      setError(passwordError);
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(payload?.error || AUTH_MESSAGES.resetLinkInvalid);
        return;
      }
      setPassword("");
      setConfirmPassword("");
      setDone(true);
    } catch {
      setError(AUTH_MESSAGES.network);
    } finally {
      inflight.current = false;
      setPending(false);
    }
  }

  if (done) {
    return (
      <AuthShell title="비밀번호 변경" description={AUTH_MESSAGES.passwordChanged}>
        <Link href="/login?reset=success" className="touch-target inline-flex w-full items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-[var(--accent-text)]">
          로그인하기
        </Link>
      </AuthShell>
    );
  }

  if (ready === "checking") {
    return (
      <AuthShell title="새 비밀번호 설정" description="재설정 링크를 확인하는 중입니다.">
        <p>잠시만 기다려 주세요.</p>
      </AuthShell>
    );
  }

  if (ready === "missing") {
    return (
      <AuthShell title="링크 오류" description={AUTH_MESSAGES.resetLinkInvalid}>
        <div className="space-y-3">
          <Link href="/forgot-password" className="touch-target inline-flex w-full items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-[var(--accent-text)]">
            새 링크 요청
          </Link>
          <Link href="/login" className="touch-target inline-flex w-full items-center justify-center rounded-xl border border-[var(--border)] px-4">
            로그인으로 돌아가기
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="새 비밀번호 설정" description="새 비밀번호를 입력해 주세요.">
      <form className="space-y-4" noValidate onSubmit={(event) => void onSubmit(event)}>
        <PasswordField
          id="new-password"
          label="새 비밀번호"
          value={password}
          autoComplete="new-password"
          minLength={MIN_NEW_PASSWORD_LENGTH}
          visible={visible}
          onVisibleChange={setVisible}
          onChange={setPassword}
          disabled={pending}
        />
        <PasswordField
          id="new-password-confirm"
          label="새 비밀번호 확인"
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
          {pending ? "저장 중..." : "비밀번호 변경"}
        </Button>
      </form>
    </AuthShell>
  );
}
