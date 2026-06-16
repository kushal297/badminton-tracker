-- Badminton Tracker — v2 additive migration
-- Apply to an already-deployed DB:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/v2.sql
--
-- These statements are additive and idempotent ("create … if not exists"), so
-- this file is safe to re-run. The same three tables are also appended to
-- supabase/schema.sql so a fresh `supabase db reset` includes them.
--
-- Design (unchanged from v1): raw rows are the only source of truth. A row in
-- `absences` means a player NO-SHOWED that session; `beer_clears` is an
-- append-only ledger of beers paid off; `app_settings` is a single-row config.
-- Beer standings (earned/cleared/owed) are recomputed in the app from these
-- rows on every read — nothing derived is stored.

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
-- BEER_CLEARS  (append-only ledger of beers paid off; lifetime "earned" never shrinks)
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

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY  (same no-auth tradeoff as v1: anon == full access)
-- ---------------------------------------------------------------------------
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

-- Table privileges. RLS decides which ROWS a role may touch, but the role still
-- needs base GRANTs on the tables. (v1 proved these are REQUIRED.)
grant select, insert, delete on absences, beer_clears to anon, authenticated;
grant select, update          on app_settings        to anon, authenticated;
