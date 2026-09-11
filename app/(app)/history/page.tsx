import { AppShell } from "@/components/layout/AppShell";
import { HistoryView } from "@/components/history/HistoryView";
import { loadPrayerItems } from "@/lib/prayers/load";

export default function HistoryPage() {
  const prayers = loadPrayerItems().map((item) => ({
    id: item.id,
    title: item.title,
    itemNumber: item.item_number,
    category: item.category,
    displayOrder: item.display_order,
  }));
  return (
    <AppShell title="기도 이력">
      <HistoryView prayers={prayers} />
    </AppShell>
  );
}
