export function AppBootSkeleton() {
  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <div className="h-14 border-b border-[var(--border)] bg-[var(--bg)] pt-[var(--safe-top)]">
        <div className="mx-auto flex min-h-14 max-w-6xl items-center px-5">
          <p className="text-lg font-semibold">기도훈련집</p>
        </div>
      </div>
      <div className="mx-auto max-w-6xl space-y-4 px-5 py-4 pb-24">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="h-4 w-24 rounded bg-[var(--border)]" />
          <div className="mt-3 h-8 w-48 rounded bg-[var(--border)]" />
          <div className="mt-4 h-3 w-full rounded-full bg-[var(--border)]" />
        </section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="h-6 w-32 rounded bg-[var(--border)]" />
          <div className="mt-3 h-4 w-full rounded bg-[var(--border)]" />
          <div className="mt-4 h-11 w-40 rounded-xl bg-[var(--border)]" />
        </section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="h-6 w-28 rounded bg-[var(--border)]" />
          <div className="mt-3 h-16 rounded bg-[var(--border)]" />
        </section>
      </div>
      <nav aria-hidden="true" className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--card)] pb-[var(--safe-bottom)] lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-4 text-center text-sm text-[var(--muted)]">
          <li className="py-3">홈</li>
          <li className="py-3">기도</li>
          <li className="py-3">이력</li>
          <li className="py-3">설정</li>
        </ul>
      </nav>
    </div>
  );
}
