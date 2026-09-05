export function CopyrightNotice({ className = "" }: { className?: string }) {
  return (
    <footer className={`border-t border-[var(--border)] pt-5 text-center ${className}`}>
      <p className="text-[11px] tracking-[0.08em] text-[var(--muted)]">Copyright © 오병이어교회</p>
      <p className="mt-1.5 text-sm leading-relaxed">권영구 담임목사</p>
      <p className="text-sm leading-relaxed">「기도훈련집」</p>
    </footer>
  );
}
