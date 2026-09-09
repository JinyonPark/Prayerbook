import { AppShell } from "@/components/layout/AppShell";
import { HistoryView } from "@/components/history/HistoryView";

export default function HistoryPage() {
  return (
    <AppShell title="기도 이력">
      <HistoryView />
    </AppShell>
  );
}
