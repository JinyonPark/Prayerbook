import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  children: ReactNode;
};

const variants: Record<NonNullable<Props["variant"]>, string> = {
  primary: "bg-[var(--accent)] text-[var(--accent-text)]",
  secondary: "bg-[var(--card)] text-[var(--text)] border border-[var(--border)]",
  ghost: "bg-transparent text-[var(--text)]",
  danger: "bg-[var(--danger)] text-white",
};

export function Button({ variant = "primary", className = "", children, ...props }: Props) {
  return (
    <button
      className={`touch-target inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-base font-medium disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
