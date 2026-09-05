"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { toUserMessage } from "@/lib/errors/user-message";
import { hasPublicEnv } from "@/lib/validation/env";
import { Button } from "@/components/ui/Button";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState<"checking" | "ok" | "missing">("checking");
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
    const timer = window.setTimeout(() => {
      void checkSession();
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, [configured]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (password !== confirm) {
      setError("새 비밀번호가 서로 다릅니다.");
      return;
    }
    setPending(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 py-10">
      <h1 className="text-2xl font-semibold">새 비밀번호 설정</h1>
      <p className="mt-2 text-[var(--muted)]">재설정 메일의 링크로 들어온 뒤 새 비밀번호를 입력해 주세요.</p>
      {ready === "checking" ? <p className="mt-6">재설정 링크를 확인하는 중입니다.</p> : null}
      {ready === "missing" ? (
        <div className="mt-6 space-y-4">
          <p role="alert">재설정 링크가 만료되었거나 유효하지 않습니다. 로그인 화면에서 메일을 다시 받아 주세요.</p>
          <Link href="/login?mode=reset" className="touch-target inline-flex rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[var(--accent-text)]">
            재설정 메일 다시 받기
          </Link>
        </div>
      ) : null}
      {ready === "ok" ? (
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm">새 비밀번호</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="touch-target w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm">새 비밀번호 확인</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="touch-target w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3"
            />
          </label>
          {error ? <p role="alert">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "저장 중..." : "비밀번호 저장"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
