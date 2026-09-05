type Props = {
  value: number;
  label: string;
};

export function ProgressBar({ value, label }: Props) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(width)} aria-label={label}>
        <div className="progress-fill" style={{ width: `${width}%` }} />
      </div>
      <p className="mt-1 text-sm text-[var(--muted)]">{label}</p>
    </div>
  );
}
