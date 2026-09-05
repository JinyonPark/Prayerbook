import { AppShell } from "@/components/layout/AppShell";
import { PersonalizeView } from "@/components/settings/PersonalizeView";

export default function PersonalizePage() {
  return (
    <AppShell title="이름·중보기도">
      <PersonalizeView />
    </AppShell>
  );
}
