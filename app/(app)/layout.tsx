import { AppProviders } from "@/components/providers/AppProviders";
import { AppHomeShell } from "@/components/layout/AppHomeShell";
import { hasPublicEnv } from "@/lib/validation/env";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  if (!hasPublicEnv()) {
    return (
      <AppProviders initialSummary={null} initialReading={null} initialPrefs={null} initialPersonalizations={[]}>
        <div className="p-6">환경 변수가 없어 서버에 연결할 수 없습니다. README를 확인해 주세요.</div>
        {children}
      </AppProviders>
    );
  }

  return (
    <AppProviders initialSummary={null} initialReading={null} initialPrefs={null} initialPersonalizations={[]}>
      <AppHomeShell>{children}</AppHomeShell>
    </AppProviders>
  );
}
