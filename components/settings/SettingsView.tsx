"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { InstallCard } from "@/components/pwa/InstallCard";
import { AccountSecurity } from "@/components/settings/AccountSecurity";
import { useAppState } from "@/components/providers/AppProviders";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { toUserMessage } from "@/lib/errors/user-message";

export function SettingsView() {
  const router = useRouter();
  const { prefs, updatePrefs, spouseSelection, updateSpouseSelection } = useAppState();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-lg font-semibold">읽기 설정</h2>
        <fieldset className="mt-3">
          <legend className="mb-2 text-sm text-[var(--muted)]">주간/야간 모드</legend>
          <div className="flex gap-2">
            <Button variant={prefs.theme === "day" ? "primary" : "secondary"} onClick={() => void updatePrefs({ theme: "day" })}>
              주간
            </Button>
            <Button variant={prefs.theme === "night" ? "primary" : "secondary"} onClick={() => void updatePrefs({ theme: "night" })}>
              야간
            </Button>
          </div>
        </fieldset>
        <fieldset className="mt-4">
          <legend className="mb-2 text-sm text-[var(--muted)]">글자 크기</legend>
          <div className="flex flex-wrap gap-2">
            {([
              ["small", "작게"],
              ["default", "기본"],
              ["large", "크게"],
              ["xlarge", "더 크게"],
            ] as const).map(([value, label]) => (
              <Button key={value} variant={prefs.fontSize === value ? "primary" : "secondary"} onClick={() => void updatePrefs({ fontSize: value })}>
                {label}
              </Button>
            ))}
          </div>
        </fieldset>
        <fieldset className="mt-4">
          <legend className="mb-2 text-sm text-[var(--muted)]">줄 간격</legend>
          <div className="flex flex-wrap gap-2">
            {([
              ["compact", "좁게"],
              ["comfortable", "보통"],
              ["spacious", "넓게"],
            ] as const).map(([value, label]) => (
              <Button key={value} variant={prefs.lineHeight === value ? "primary" : "secondary"} onClick={() => void updatePrefs({ lineHeight: value })}>
                {label}
              </Button>
            ))}
          </div>
        </fieldset>
      </section>

      <InstallCard />

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-lg font-semibold">배우자 기도 선택</h2>
        <p className="mt-2 text-[var(--muted)]">
          남편을 위한 기도와 아내를 위한 기도 중 진행률에 넣을 항목을 선택합니다. 선택하지 않은 기도의 완료 횟수는 삭제되지 않습니다.
        </p>
        {spouseSelection ? null : <p className="mt-2">배우자 기도를 선택해 주세요.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant={spouseSelection === "husband" ? "primary" : "secondary"} onClick={() => void updateSpouseSelection("husband")}>
            남편을 위한 기도
          </Button>
          <Button variant={spouseSelection === "wife" ? "primary" : "secondary"} onClick={() => void updateSpouseSelection("wife")}>
            아내를 위한 기도
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-lg font-semibold">이름·중보기도</h2>
        <p className="mt-2 text-[var(--muted)]">
          태신자, 가족, 교회·목장 중보기도처럼 괄호에 넣는 내용을 저장합니다. 기도문 본문을 스크롤할 때는 편집 창이 열리지
          않습니다.
        </p>
        <Link href="/settings/personalize" className="touch-target mt-3 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[var(--accent-text)]">
          이름·중보기도 관리
        </Link>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-lg font-semibold">기도 횟수 관리</h2>
        <p className="mt-2 text-[var(--muted)]">항목별 수정, 초기화, 일괄 설정을 할 수 있습니다.</p>
        <Link href="/settings/progress" className="touch-target mt-3 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[var(--accent-text)]">
          기도 횟수 관리로 이동
        </Link>
      </section>

      <AccountSecurity />

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-lg font-semibold">계정</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              const supabase = createBrowserSupabaseClient();
              await supabase.auth.signOut();
              router.replace("/login");
              router.refresh();
            }}
          >
            로그아웃
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-center">
        <h2 className="text-lg font-semibold">저작권</h2>
        <p className="mt-3 text-[11px] tracking-[0.08em] text-[var(--muted)]">Copyright © 오병이어교회</p>
        <p className="mt-2">저자 권영구 담임목사</p>
        <p>원작 「기도훈련집」</p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          기도문의 저작권은 오병이어교회에 있습니다. 이 앱은 원문의 뜻을 바꾸지 않고, 개인적으로 읽고 기록하기 위해
          만들었습니다.
        </p>
        <a href="https://52ch.kr" className="touch-target mt-4 inline-flex rounded-xl border border-[var(--border)] px-4 py-2.5" target="_blank" rel="noreferrer">
          오병이어교회 홈페이지
        </a>
      </section>

      <section className="rounded-2xl border border-[var(--danger)] bg-[var(--card)] p-5">
        <h2 className="text-lg font-semibold">회원 탈퇴</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          회원 탈퇴는 기도 기록 초기화와 다릅니다. 탈퇴하면 계정, 진행 기록, 설정이 삭제됩니다.
        </p>
        <Button variant="danger" className="mt-3" onClick={() => { setConfirmText(""); setError(null); setDeleteOpen(true); }}>
          회원 탈퇴
        </Button>
      </section>

      <Modal open={deleteOpen} title="회원 탈퇴" onClose={() => { setDeleteOpen(false); setConfirmText(""); }} closeDisabled={pending}>
        <p>정말로 탈퇴하시겠습니까? 기도 기록과 설정이 함께 삭제되며 되돌릴 수 없습니다.</p>
        <p className="mt-3 text-sm">확인을 위해 회원 탈퇴를 입력하세요.</p>
        <input
          key={deleteOpen ? "confirm-open" : "confirm-closed"}
          className="touch-target mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3"
          defaultValue=""
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          lang="ko"
          disabled={pending}
          onInput={(event) => setConfirmText(event.currentTarget.value)}
        />
        {error ? <p className="mt-2" role="alert">{error}</p> : null}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => { setDeleteOpen(false); setConfirmText(""); }} disabled={pending}>
            취소
          </Button>
          <Button
            variant="danger"
            disabled={pending || confirmText.normalize("NFC") !== "회원 탈퇴"}
            onClick={async () => {
              setPending(true);
              setError(null);
              try {
                const response = await fetch("/api/account/delete", { method: "POST" });
                if (!response.ok) throw new Error("탈퇴에 실패했습니다.");
                router.replace("/login");
                router.refresh();
              } catch (err) {
                setError(toUserMessage(err));
                setPending(false);
              }
            }}
          >
            {pending ? "처리 중..." : "탈퇴"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
