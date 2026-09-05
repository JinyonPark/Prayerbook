import { AppShell } from "@/components/layout/AppShell";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { loadPrayerItems } from "@/lib/prayers/load";

export default function HomePage() {
  const prayers = loadPrayerItems();
  return (
    <AppShell title="기도훈련집">
      <DashboardView prayers={prayers} />
    </AppShell>
  );
}
