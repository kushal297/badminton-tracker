-- Badminton Tracker — database schema
-- Run this once in the Supabase SQL Editor (or `supabase db reset`).
--
-- Design notes:
--   * Raw `games` rows are the ONLY source of truth. Ratings, leaderboard,
--     head-to-head, chemistry, streaks, badges and charts are all recomputed
--     in the app from these rows on every read. Nothing derived is stored.
--   * Winner and on-court membership are GENERATED columns, never hand-set.
--   * Edits/deletes are first-class: soft-delete (`deleted_at`) + an append-only
--     `game_events` audit log are the recovery net for this no-auth app.

-- ---------------------------------------------------------------------------
-- PLAYERS
-- ---------------------------------------------------------------------------
create table if not exists players (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text,                                   -- chart line color (optional)
  is_active  boolean not null default true,          -- retire a player without deleting history
  created_at timestamptz not null default now(),
  constraint players_name_not_blank check (length(btrim(name)) > 0)
);
create unique index if not exists players_name_ci_unique on players (lower(btrim(name)));

-- ---------------------------------------------------------------------------
-- SESSIONS  (a "day of play")
-- ---------------------------------------------------------------------------
create table if not exists sessions (
  id         uuid primary key default gen_random_uuid(),
  played_on  date not null,
  label      text,
  created_at timestamptz not null default now(),
  constraint sessions_one_per_day unique (played_on)
);
create index if not exists sessions_played_on_idx on sessions (played_on desc);

-- ---------------------------------------------------------------------------
-- GAMES  (one row = one 2v2 game; one of five players sits out)
-- ---------------------------------------------------------------------------
create table if not exists games (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions(id) on delete cascade,
  session_seq   int  not null default 0,             -- order within its day (1,2,3...)

  team_a1       uuid not null references players(id) on delete restrict,
  team_a2       uuid not null references players(id) on delete restrict,
  team_b1       uuid not null references players(id) on delete restrict,
  team_b2       uuid not null references players(id) on delete restrict,
  sat_out       uuid          references players(id) on delete restrict,  -- nullable (4-player day)

  score_a       smallint not null,
  score_b       smallint not null,
  game_target   smallint not null default 21,        -- 21/15/11; enables deuce detection

  played_at     timestamptz not null default now(),  -- ordering tiebreak within/across sessions
  deleted_at    timestamptz,                          -- soft delete (recoverable)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint games_scores_nonneg check (score_a >= 0 and score_b >= 0),
  constraint games_no_tie        check (score_a <> score_b),
  constraint games_target_pos    check (game_target > 0),
  constraint games_players_distinct check (
        team_a1 <> team_a2 and team_a1 <> team_b1 and team_a1 <> team_b2
    and team_a2 <> team_b1 and team_a2 <> team_b2 and team_b1 <> team_b2
    and (sat_out is null or sat_out not in (team_a1, team_a2, team_b1, team_b2))
  )
);

-- Derived, consistent-by-construction:
alter table games add column if not exists winner_team char(1)
  generated always as (case when score_a > score_b then 'A' else 'B' end) stored;
alter table games add column if not exists player_ids uuid[]
  generated always as (array[team_a1, team_a2, team_b1, team_b2]) stored;

create index if not exists games_player_ids_gin on games using gin (player_ids);
create index if not exists games_session_idx     on games (session_id);
create index if not exists games_order_idx       on games (played_at, session_seq, created_at)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- AUDIT LOG  (append-only; survives game deletion so the trail stays honest)
-- ---------------------------------------------------------------------------
create table if not exists game_events (
  id          bigint generated always as identity primary key,
  game_id     uuid,                                  -- intentionally NOT a cascading FK
  action      text not null check (action in ('create','edit','delete','restore')),
  editor_name text,                                  -- self-reported "who's entering"
  before_data jsonb,
  after_data  jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists game_events_game_idx on game_events (game_id, created_at);

-- Keep `updated_at` fresh on every edit.
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end
$$ language plpgsql;

drop trigger if exists games_set_updated_at on games;
create trigger games_set_updated_at before update on games
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
-- This app has no login. The anon key ships in the browser, so the link == full
-- read/write access. That is the accepted tradeoff for a private group sharing
-- one unlisted URL. RLS stays ON with explicit permissive policies (clearer than
-- disabling it, and it passes Supabase's linter). The audit log is the only table
-- the anon role cannot update or delete, so the trail cannot be quietly rewritten.
alter table players     enable row level security;
alter table sessions    enable row level security;
alter table games       enable row level security;
alter table game_events enable row level security;

drop policy if exists anon_all_players  on players;
drop policy if exists anon_all_sessions on sessions;
drop policy if exists anon_all_games    on games;
drop policy if exists anon_read_events   on game_events;
drop policy if exists anon_insert_events on game_events;

create policy anon_all_players  on players  for all    to anon using (true) with check (true);
create policy anon_all_sessions on sessions for all    to anon using (true) with check (true);
create policy anon_all_games    on games    for all    to anon using (true) with check (true);
create policy anon_read_events   on game_events for select to anon using (true);
create policy anon_insert_events on game_events for insert to anon with check (true);

-- Table privileges. RLS decides which ROWS a role may touch, but the role still
-- needs base GRANTs on the tables. (Hosted Supabase often adds these by default;
-- granting explicitly makes this schema self-contained on any Postgres.)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on players, sessions, games to anon, authenticated;
grant select, insert on game_events to anon, authenticated;

-- ---------------------------------------------------------------------------
-- SEED  (optional). Adds five players you can rename in-app on the Players screen.
-- Safe to re-run: skips names that already exist.
-- ---------------------------------------------------------------------------
insert into players (name)
select v.name
from (values ('Player 1'), ('Player 2'), ('Player 3'), ('Player 4'), ('Player 5')) as v(name)
where not exists (
  select 1 from players p where lower(btrim(p.name)) = lower(btrim(v.name))
);

-- ===========================================================================
-- v2 — beer board (no-show tracking)
-- ===========================================================================
-- Additive. Kept here so a fresh `supabase db reset` includes them; the same
-- statements live in supabase/v2.sql for applying to already-deployed DBs.
-- A row in `absences` means a player NO-SHOWED that session. `beer_clears` is an
-- append-only ledger of beers paid off (lifetime "earned" never shrinks).
-- Beer standings (earned/cleared/owed) are recomputed in the app on every read.

-- ---------------------------------------------------------------------------
-- ABSENCES  (one row = that player no-showed that session)
-- ---------------------------------------------------------------------------
create table if not exists absences (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  player_id  uuid not null references players(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (session_id, player_id)
);

-- ---------------------------------------------------------------------------
-- BEER_CLEARS  (append-only ledger of beers paid off)
-- ---------------------------------------------------------------------------
create table if not exists beer_clears (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references players(id) on delete restrict,
  beers      int  not null check (beers > 0),
  cleared_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- APP_SETTINGS  (single row: id is always true)
-- ---------------------------------------------------------------------------
create table if not exists app_settings (
  id                boolean primary key default true check (id),
  beers_per_no_show int not null default 6 check (beers_per_no_show > 0)
);
insert into app_settings (id) values (true) on conflict (id) do nothing;

alter table absences     enable row level security;
alter table beer_clears  enable row level security;
alter table app_settings enable row level security;

drop policy if exists anon_all_absences      on absences;
drop policy if exists anon_all_beer_clears   on beer_clears;
drop policy if exists anon_select_settings   on app_settings;
drop policy if exists anon_update_settings   on app_settings;

create policy anon_all_absences    on absences    for all    to anon using (true) with check (true);
create policy anon_all_beer_clears on beer_clears for all    to anon using (true) with check (true);
create policy anon_select_settings on app_settings for select to anon using (true);
create policy anon_update_settings on app_settings for update to anon using (true) with check (true);

grant select, insert, delete on absences, beer_clears to anon, authenticated;
grant select, update          on app_settings        to anon, authenticated;

-- ===========================================================================
-- v3 — player photos + manual (date-based) no-shows + storage bucket
-- ===========================================================================
-- Additive and idempotent. Kept here so a fresh `supabase db reset` includes
-- them; the same statements live in supabase/v3.sql for already-deployed DBs.
--   1. players.photo_url   — optional per-player photo (stored in Supabase Storage)
--   2. absences reshaped to MANUAL, date-based no-shows decoupled from sessions:
--      a row now means "this player no-showed on this calendar day" and is
--      authoritative (no more "played that session" filtering). Standings still
--      recompute from these rows on every read.
--   3. a public `player-photos` storage bucket + anon Storage policies/grants.

-- ---------------------------------------------------------------------------
-- PLAYERS — optional photo
-- ---------------------------------------------------------------------------
alter table players add column if not exists photo_url text;

-- ---------------------------------------------------------------------------
-- ABSENCES — manual, date-based no-shows (decoupled from sessions/games)
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
-- STORAGE — public bucket for player photos + anon policies/grants
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

grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;
