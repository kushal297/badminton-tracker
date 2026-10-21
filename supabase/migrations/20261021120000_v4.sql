-- v4: run once after v3 in the Supabase SQL editor; idempotent, safe to re-run.
-- Later sections are appended by Tasks 6 and 7 of docs/superpowers/plans/2026-10-21-review-fixes.md.

-- 1. Ensure the single settings row exists (Task 3)
insert into app_settings (id) values (true) on conflict (id) do nothing;
