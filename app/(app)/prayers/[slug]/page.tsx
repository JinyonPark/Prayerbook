import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PrayerReader } from "@/components/prayer/PrayerReader";
import { getAdjacentPrayers, loadPrayerItems } from "@/lib/prayers/load";

export function generateStaticParams() {
  try {
    return loadPrayerItems().map((item) => ({ slug: item.slug }));
  } catch {
    return [];
  }
}

export default async function PrayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const adjacent = getAdjacentPrayers(slug);
  if (!adjacent) notFound();
  const prayers = loadPrayerItems();

  return (
    <AppShell title="기도문" hideBottomNav hideHeaderOnMobile compactMobilePadding>
      <PrayerReader
        prayer={adjacent.current}
        previous={adjacent.previous}
        next={adjacent.next}
        prayers={prayers}
      />
    </AppShell>
  );
}
