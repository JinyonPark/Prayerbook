"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { toUserMessage } from "@/lib/errors/user-message";
import { passwordResetCallbackUrl } from "@/lib/auth/redirect";
import { getSiteUrl, hasPublicEnv } from "@/lib/validation/env";
import { Button } from "@/components/ui/Button";
import { CopyrightNotice } from "@/components/brand/CopyrightNotice";

type Mode = "login" | "signup" | "reset";

export function AuthPanel() {
  const router = useRouter();
  const search = useSearchParams();
  const initialMode = search.get("mode");
  const [mode, setMode] = useState<Mode>(
    initialMode === "signup" || initialMode === "reset" ? initialMode : "login",
  );
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const configured = useMemo(() => hasPublicEnv(), []);

  useEffect(() => {
    if (search.get("mode") === "update") {
      router.replace("/auth/update-password");
    }
  }, [router, search]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!configured) {
      setError("서버 연결 정보가 없습니다. README의 환경 변수 안내를 확인해 주세요.");
      return;
    }
    setPending(true);
    try {
      if (mode === "login" || mode === "signup") {
        const response = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, password }),
        });
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok) {
          setError(payload?.error || "요청을 처리하지 못했습니다.");
          return;
        }
        router.replace(search.get("next") || "/");
        router.refresh();
        return;
      }
      if (!identifier.includes("@")) {
        setError("아이디로 만든 계정은 비밀번호 재설정 메일을 보낼 수 없습니다. 이메일을 입력해 주세요.");
        return;
      }
      const supabase = createBrowserSupabaseClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(identifier, {
        redirectTo: passwordResetCallbackUrl(getSiteUrl()),
      });
      if (resetError) throw resetError;
      setMessage("비밀번호 재설정 메일을 보냈습니다. 메일 속 링크를 열면 새 비밀번호를 설정할 수 있습니다.");
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[max(2.5rem,var(--safe-bottom))] pt-[max(2.5rem,var(--safe-top))]">
      <div className="flex-1">
      <div className="text-center">
        <img
          src="/icons/icon-192.png?v=5"
          alt=""
          width={72}
          height={72}
          className="mx-auto rounded-[1.15rem] border border-[var(--border)] bg-[var(--card)]"
        />
        <h1 className="mt-4 text-2xl font-semibold">기도훈련집</h1>
        <p className="mt-2 text-[var(--muted)]">계정으로 기도 기록을 모든 기기에서 이어갑니다.</p>
      </div>
      {search.get("error") === "config" ? (
        <p className="mt-4 rounded-xl bg-[var(--card)] p-3 text-sm">환경 변수가 설정되지 않았습니다.</p>
      ) : null}
      {search.get("error") === "reset" ? (
        <p className="mt-4 rounded-xl bg-[var(--card)] p-3 text-sm">
          재설정 링크가 만료되었거나 유효하지 않습니다. 메일을 다시 받아 주세요.
        </p>
      ) : null}
      <div className="mt-6 grid grid-cols-3 gap-2" role="tablist" aria-label="인증 방식">
        {([
          ["login", "로그인"],
          ["signup", "회원가입"],
          ["reset", "비밀번호 재설정"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            className={`touch-target rounded-xl border px-2 text-sm ${mode === value ? "border-[var(--accent)] font-semibold" : "border-[var(--border)]"}`}
            onClick={() => {
              setMode(value);
              if (value === "login") {
                setIdentifier("");
                setPassword("");
                setError(null);
                setMessage(null);
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-1 block text-sm">{mode === "reset" ? "이메일" : "아이디 또는 이메일"}</span>
          <input
            type={mode === "reset" ? "email" : "text"}
            required
            autoComplete={mode === "reset" ? "email" : "username"}
            inputMode={mode === "reset" ? "email" : "text"}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className="touch-target w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3"
          />
        </label>
        {mode === "signup" ? (
          <p className="text-sm text-[var(--muted)]">이메일 없이 아이디와 비밀번호만으로 가입할 수 있습니다.</p>
        ) : null}
        {mode === "reset" ? (
          <p className="text-sm text-[var(--muted)]">아이디로 만든 계정은 재설정 메일을 보낼 수 없습니다.</p>
        ) : null}
        {mode !== "reset" ? (
          <label className="block">
            <span className="mb-1 block text-sm">비밀번호</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="touch-target w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3"
            />
          </label>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
        {message ? <p role="status">{message}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "처리 중..." : mode === "login" ? "로그인" : mode === "signup" ? "회원가입" : "재설정 메일 보내기"}
        </Button>
      </form>
      </div>
      <CopyrightNotice className="mt-10" />
    </div>
  );
}
