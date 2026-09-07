"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { toUserMessage } from "@/lib/errors/user-message";

type SecurityInfo = {
  loginId: string | null;
  recoveryEmail: string | null;
};

export function AccountSecurity() {
  const [info, setInfo] = useState<SecurityInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [passwordPending, setPasswordPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/account/security");
        const payload = (await response.json().catch(() => null)) as (SecurityInfo & { error?: string }) | null;
        if (!response.ok) {
          throw new Error(payload?.error || "계정 정보를 불러오지 못했습니다.");
        }
        if (!cancelled && payload) {
          setInfo({ loginId: payload.loginId, recoveryEmail: payload.recoveryEmail });
          setRecoveryEmail(payload.recoveryEmail ?? "");
        }
      } catch (error) {
        if (!cancelled) setLoadError(toUserMessage(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h2 className="text-lg font-semibold">비밀번호·복구 이메일</h2>
      {info?.loginId ? <p className="mt-2 text-sm text-[var(--muted)]">로그인 아이디 {info.loginId}</p> : null}
      {loadError ? <p className="mt-2" role="alert">{loadError}</p> : null}

      <form
        className="mt-4 space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setRecoveryError(null);
          setRecoveryMessage(null);
          setRecoveryPending(true);
          try {
            const response = await fetch("/api/account/recovery-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: recoveryEmail }),
            });
            const payload = (await response.json().catch(() => null)) as { error?: string; recoveryEmail?: string } | null;
            if (!response.ok) {
              setRecoveryError(payload?.error || "복구 이메일을 저장하지 못했습니다.");
              return;
            }
            setInfo((current) => ({ loginId: current?.loginId ?? null, recoveryEmail: payload?.recoveryEmail ?? recoveryEmail }));
            setRecoveryMessage("복구 이메일을 저장했습니다. 이제 비밀번호 재설정 메일을 받을 수 있습니다.");
          } catch (error) {
            setRecoveryError(toUserMessage(error));
          } finally {
            setRecoveryPending(false);
          }
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm">복구 이메일</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={recoveryEmail}
            onChange={(event) => setRecoveryEmail(event.target.value)}
            className="touch-target w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3"
          />
        </label>
        <p className="text-sm text-[var(--muted)]">
          로그인할 때는 아이디를 그대로 씁니다. 비밀번호를 잊으면 이 주소로 재설정 메일이 갑니다.
        </p>
        {recoveryError ? <p role="alert">{recoveryError}</p> : null}
        {recoveryMessage ? <p role="status">{recoveryMessage}</p> : null}
        <Button type="submit" disabled={recoveryPending}>
          {recoveryPending ? "저장 중..." : info?.recoveryEmail ? "복구 이메일 변경" : "복구 이메일 등록"}
        </Button>
      </form>

      <form
        className="mt-8 space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setPasswordError(null);
          setPasswordMessage(null);
          if (nextPassword.length < 8) {
            setPasswordError("비밀번호는 최소 8자 이상 입력해 주세요.");
            return;
          }
          if (nextPassword !== confirmPassword) {
            setPasswordError("새 비밀번호가 서로 다릅니다.");
            return;
          }
          setPasswordPending(true);
          try {
            const response = await fetch("/api/account/password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ currentPassword, nextPassword }),
            });
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            if (!response.ok) {
              setPasswordError(payload?.error || "비밀번호를 바꾸지 못했습니다.");
              return;
            }
            setCurrentPassword("");
            setNextPassword("");
            setConfirmPassword("");
            setPasswordMessage("비밀번호를 바꿨습니다.");
          } catch (error) {
            setPasswordError(toUserMessage(error));
          } finally {
            setPasswordPending(false);
          }
        }}
      >
        <h3 className="font-semibold">비밀번호 변경</h3>
        <p className="text-sm text-[var(--muted)]">로그인한 상태에서는 메일 없이 비밀번호를 바꿀 수 있습니다.</p>
        <label className="block">
          <span className="mb-1 block text-sm">현재 비밀번호</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="touch-target w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">새 비밀번호</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={nextPassword}
            onChange={(event) => setNextPassword(event.target.value)}
            className="touch-target w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">새 비밀번호 확인</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="touch-target w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3"
          />
        </label>
        {passwordError ? <p role="alert">{passwordError}</p> : null}
        {passwordMessage ? <p role="status">{passwordMessage}</p> : null}
        <Button type="submit" disabled={passwordPending}>
          {passwordPending ? "저장 중..." : "비밀번호 변경"}
        </Button>
      </form>
    </section>
  );
}
