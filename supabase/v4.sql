-- v4: run once after v3 in the Supabase SQL editor; idempotent, safe to re-run.
-- Later sections are appended by Tasks 6 and 7 of docs/superpowers/plans/2026-10-21-review-fixes.md.

-- 1. Ensure the single settings row exists (Task 3)
insert into app_settings (id) values (true) on conflict (id) do nothing;

-- 2. One sequence number per game within a session (Task 6)
-- Two saves on the same day could both read max(session_seq)+1 and write the same number.
-- The constraint covers every row, soft-deleted included, because nextSessionSeq in
-- app/actions/games.ts ignores deleted_at; the app retries on the resulting 23505.
--
-- Precondition: the Task 0 Step 2 pre-flight query returned zero rows:
--   select session_id, session_seq, count(*) from games group by 1,2 having count(*) > 1;
-- If it returned any rows, renumber first, otherwise adding the constraint fails.
-- Only if duplicates exist, run this once before this section (assigns 1..n per session):
--   update games g set session_seq = r.n
--     from (select id, row_number() over (partition by session_id
--                                         order by session_seq, created_at, id) as n
--             from games) r
--    where g.id = r.id and g.session_seq <> r.n;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'games_session_seq_unique') then
    alter table games add constraint games_session_seq_unique unique (session_id, session_seq);
  end if;
end $$;

-- 3. Audit integrity (Task 7)
-- The app only soft-deletes games (deleted_at) and never deletes sessions or players, so
-- anon has no reason to hard-delete them; without this, anyone with the key could erase rows
-- through the REST API with no audit trail. The only hard delete in the app is a no-show
-- (absences), which keeps its grant.
revoke delete on games, sessions, players from anon, authenticated;

-- One beer clear per debt: earned_total is the player's lifetime beers earned at the moment
-- of the clear. Two concurrent Mark Paid taps compute the same total, so the second insert
-- hits 23505 and the app treats it as success; a later clear after new no-shows has a higher
-- total and goes through. Historical rows keep earned_total null, and Postgres treats NULLs
-- as distinct in a unique constraint, so they never collide with each other or new rows.
alter table beer_clears add column if not exists earned_total int;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'beer_clears_one_per_debt') then
    alter table beer_clears add constraint beer_clears_one_per_debt unique (player_id, earned_total);
  end if;
end $$;
