import type { ReactNode } from "react";
import { CopyrightNotice } from "@/components/brand/CopyrightNotice";
import { InstallButton } from "@/components/pwa/InstallButton";

export function AuthShell({
  children,
  title = "기도훈련집",
  description,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[max(2.5rem,var(--safe-bottom))] pt-[max(2.5rem,var(--safe-top))]">
      <main id="main" className="flex-1">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png?v=5"
            alt=""
            width={72}
            height={72}
            className="mx-auto rounded-[1.15rem] border border-[var(--border)] bg-[var(--card)]"
          />
          <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
          {description ? <p className="mt-2 whitespace-pre-line text-[var(--muted)]">{description}</p> : null}
        </div>
        <div className="mt-6">{children}</div>
        <InstallButton className="mt-6 w-full" />
      </main>
      <CopyrightNotice className="mt-10" />
    </div>
  );
}
