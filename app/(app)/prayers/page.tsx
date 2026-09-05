import { AppShell } from "@/components/layout/AppShell";
import { loadPrayerItems } from "@/lib/prayers/load";
import { DashboardProgress } from "@/components/prayer/DashboardProgress";

export default function PrayersPage() {
  const prayers = loadPrayerItems();
  const main = prayers.filter((item) => item.category === "main");
  const supplementary = prayers.filter((item) => item.category === "supplementary");

  return (
    <AppShell title="기도 목록">
      <DashboardProgress main={main} supplementary={supplementary} />
    </AppShell>
  );
}
