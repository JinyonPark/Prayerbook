-- Optional Postgres checks after migrations. Not executed automatically against production.
-- Run only on a reset or disposable database.

-- 37.1 Same user, same prayer, same day, 10 completes:
--   user_prayer_progress.completion_count +10
--   user_daily_prayer_stats rows = 1, total = 10, item_counts[code] = 10
--   user_monthly_prayer_stats rows = 1, total = 10
--   user_prayer_totals.lifetime_completion_count = 10
--   prayer_progress_operations complete inserts = 0

-- 37.2 Same day, 5 different prayers:
--   daily rows = 1, daily total = 5, unique = 5, monthly rows = 1, lifetime +5

-- 37.3 Next date first complete:
--   new daily row, same-month monthly row updated, lifetime +1

-- 37.4 Next month first complete:
--   new daily row, new monthly row, lifetime +1

-- 37.5 Duplicate client_event_id:
--   all counters +1 once, second call idempotent

-- 37.6 Concurrent 20 distinct client_event_ids:
--   progress/daily/monthly/lifetime exactly +20

-- 37.7 Mid-transaction error:
--   no progress/daily/monthly/lifetime/dedup writes

-- Retention:
--   daily older than 30 local days deleted
--   monthly older than 12 months deleted
--   dedup older than 48 hours deleted
--   manual audit older than 90 days deleted
--   progress, lifetime, preferences, inputs kept

select 'documentation-only; do not execute writes against production' as note;
