-- Badminton Tracker — v3 additive migration
-- Apply to an already-deployed DB:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/v3.sql
--
-- Idempotent and safe to re-run. The same statements are appended to
-- supabase/schema.sql so a fresh `supabase db reset` includes them.
--
-- v3 brings three foundation changes:
--   1. players.photo_url   — optional per-player photo (stored in Supabase Storage)
--   2. absences reshaped to MANUAL, date-based no-shows, fully decoupled from
--      sessions/games. A row in `absences` now means "this player no-showed on
--      this calendar day"; it is authoritative (no more "played that session"
--      filtering). Beer standings still recompute from these rows on every read.
--   3. a public `player-photos` storage bucket + anon Storage policies/grants
--      (same no-auth tradeoff as the rest of the app: the link == access).

-- ---------------------------------------------------------------------------
-- 1. PLAYERS — optional photo
-- ---------------------------------------------------------------------------
alter table players add column if not exists photo_url text;

-- ---------------------------------------------------------------------------
-- 2. ABSENCES — manual, date-based no-shows (decoupled from sessions/games)
-- ---------------------------------------------------------------------------
alter table absences add column if not exists noshow_on date;
alter table absences add column if not exists note text;

-- Backfill the calendar day from the linked session before dropping session_id.
update absences a
   set noshow_on = s.played_on
  from sessions s
 where a.session_id = s.id
   and a.noshow_on is null;

alter table absences alter column noshow_on set not null;

alter table absences drop constraint if exists absences_session_id_player_id_key;
alter table absences drop column if exists session_id;

create unique index if not exists absences_player_day_unique
  on absences (player_id, noshow_on);

-- ---------------------------------------------------------------------------
-- 3. STORAGE — public bucket for player photos + anon policies/grants
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'player-photos',
  'player-photos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public            = excluded.public,
  file_size_limit   = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists anon_select_player_photos on storage.objects;
drop policy if exists anon_insert_player_photos on storage.objects;
drop policy if exists anon_update_player_photos on storage.objects;
drop policy if exists anon_delete_player_photos on storage.objects;

create policy anon_select_player_photos on storage.objects
  for select to anon using (bucket_id = 'player-photos');
create policy anon_insert_player_photos on storage.objects
  for insert to anon with check (bucket_id = 'player-photos');
create policy anon_update_player_photos on storage.objects
  for update to anon using (bucket_id = 'player-photos') with check (bucket_id = 'player-photos');
create policy anon_delete_player_photos on storage.objects
  for delete to anon using (bucket_id = 'player-photos');

-- Base privileges. RLS decides which ROWS a role may touch, but the role still
-- needs base GRANTs (v1/v2 proved these are REQUIRED on top of the policies).
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;
