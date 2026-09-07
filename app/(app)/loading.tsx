export default function Loading() {
  return (
    <div className="min-h-dvh bg-[var(--bg)] p-5 pt-[max(1.25rem,var(--safe-top))]">
      <div className="h-8 w-40 rounded-xl bg-[var(--border)]" />
      <div className="mt-4 h-32 rounded-2xl bg-[var(--card)]" />
      <div className="mt-3 h-24 rounded-2xl bg-[var(--card)]" />
      <p className="mt-4 text-[var(--muted)]">불러오는 중</p>
    </div>
  );
}
