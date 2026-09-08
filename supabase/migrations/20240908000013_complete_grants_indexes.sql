-- Additive grants and index only. Does not change completion counts or auth users.

grant execute on function public.complete_prayer(uuid, uuid) to authenticated;
grant execute on function public.get_prayer_progress_summary() to authenticated;
grant execute on function public.get_daily_prayer_summary(date) to authenticated;

create index if not exists prayer_items_active_display_idx
  on public.prayer_items (is_active, display_order);
