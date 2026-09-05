import { redirect } from "next/navigation";
import { AppProviders } from "@/components/providers/AppProviders";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchProgressSummary } from "@/lib/supabase/rpc";
import { hasPublicEnv } from "@/lib/validation/env";
import type { ReadingState, UserPreferences } from "@/lib/progress/types";
import type { PersonalizationRow } from "@/lib/prayers/personalize";

export const dynamic = "force-dynamic";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  if (!hasPublicEnv()) {
    return (
      <AppProviders initialSummary={null} initialReading={null} initialPrefs={null} initialPersonalizations={[]}>
        <div className="p-6">환경 변수가 없어 서버에 연결할 수 없습니다. README를 확인해 주세요.</div>
        {children}
      </AppProviders>
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let summary = null;
  try {
    summary = await fetchProgressSummary(supabase);
  } catch {
    summary = {
      total_completed: 0,
      current_round: 1,
      current_completed_count: 0,
      progress_percent: 0,
      items: [],
    };
  }

  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("theme, font_size, line_height")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: reading } = await supabase
    .from("user_reading_state")
    .select("last_prayer_item_id, scroll_ratio, last_opened_at, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: personalizationData } = await supabase
    .from("user_prayer_personalizations")
    .select("id, prayer_slug, slot_key, value, sort_order")
    .order("sort_order");

  return (
    <AppProviders
      initialSummary={summary}
      initialReading={(reading as ReadingState | null) ?? null}
      initialPrefs={(prefs as UserPreferences | null) ?? null}
      initialPersonalizations={(personalizationData as PersonalizationRow[] | null) ?? []}
    >
      {children}
    </AppProviders>
  );
}
