import { AppShell } from "@/components/layout/AppShell";
import { SettingsView } from "@/components/settings/SettingsView";

export default function SettingsPage() {
  return (
    <AppShell title="설정">
      <SettingsView />
    </AppShell>
  );
}
