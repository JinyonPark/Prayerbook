import { AppShell } from "@/components/layout/AppShell";
import { ProgressManager } from "@/components/settings/ProgressManager";
import { loadPrayerItems } from "@/lib/prayers/load";

export default function ProgressSettingsPage() {
  const prayers = loadPrayerItems();
  return (
    <AppShell title="기도 횟수 관리">
      <ProgressManager prayers={prayers} />
    </AppShell>
  );
}
