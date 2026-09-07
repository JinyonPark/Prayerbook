import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { AUTH_MESSAGES } from "@/lib/auth/messages";

const REASONS: Record<string, string> = {
  missing: AUTH_MESSAGES.resetLinkInvalid,
  expired: AUTH_MESSAGES.resetLinkInvalid,
  invalid: AUTH_MESSAGES.resetLinkInvalid,
  exchange: AUTH_MESSAGES.resetLinkInvalid,
  session: AUTH_MESSAGES.resetLinkInvalid,
};

export function AuthErrorView({ reason }: { reason?: string | null }) {
  const description = REASONS[reason ?? ""] ?? AUTH_MESSAGES.resetLinkInvalid;
  return (
    <AuthShell title="인증 오류" description={description}>
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
