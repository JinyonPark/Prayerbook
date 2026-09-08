export default function Loading() {
  return (
    <div className="min-h-[50vh] bg-[var(--bg)] px-3 pt-[var(--safe-top)]">
      <div className="h-12 rounded-xl bg-[var(--card)]" />
      <div className="mt-4 space-y-3">
        <div className="h-6 w-2/3 rounded bg-[var(--border)]" />
        <div className="h-40 rounded-2xl bg-[var(--card)]" />
        <div className="h-40 rounded-2xl bg-[var(--card)]" />
      </div>
    </div>
  );
}
