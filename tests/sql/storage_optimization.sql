-- Optional Postgres checks after `npx supabase db reset`.
-- Not executed automatically. Requires a local Supabase/Postgres with migrations applied.

-- 1. Complete once should not add complete operations.
-- 2. Same-day completes update one daily row.
-- 3. Duplicate client_event_id is idempotent.
-- 4. purge_prayer_storage is not granted to authenticated.

select 'run against a reset database; this file is documentation-only' as note;
