"use client";

type Props = {
  id: string;
  label: string;
  value: string;
  autoComplete: string;
  disabled?: boolean;
  minLength?: number;
  maxLength?: number;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  onChange: (value: string) => void;
};

export function PasswordField({
  id,
  label,
  value,
  autoComplete,
  disabled,
  minLength,
  maxLength = 72,
  visible,
  onVisibleChange,
  onChange,
}: Props) {
  return (
    <div>
      <label className="mb-1 block text-sm" htmlFor={id}>
        {label}
      </label>
      <span className="relative block">
        <input
          id={id}
          type={visible ? "text" : "password"}
          required
          minLength={minLength}
          maxLength={maxLength}
          autoComplete={autoComplete}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="touch-target w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 pr-20"
        />
        <button
          type="button"
          className="touch-target absolute right-1 top-1/2 -translate-y-1/2 rounded-lg px-3 text-sm text-[var(--muted)]"
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => onVisibleChange(!visible)}
        >
          {visible ? "숨김" : "표시"}
        </button>
      </span>
    </div>
  );
}
