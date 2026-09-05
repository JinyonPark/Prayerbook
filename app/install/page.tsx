import { AppHeader } from "@/components/layout/AppShell";
import { InstallGuide } from "@/components/pwa/InstallCard";

export default function InstallPage() {
  return (
    <div className="min-h-dvh">
      <AppHeader title="앱 설치" />
      <main id="main" className="mx-auto max-w-3xl px-5 py-6">
        <InstallGuide />
      </main>
    </div>
  );
}
