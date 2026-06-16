# 🏸 Badminton Tracker

A self-hostable scoreboard and stats tracker for a small group that plays **2v2 rotating-partner badminton** (four play, one sits out each game). Log a day's games on your phone, fix mistakes any time, and settle who's actually best — with a fair skill rating, head-to-head and partner-chemistry breakdowns, badges, and trends.

Built to deploy once on free tiers and share with one link. No logins — anyone with the link can add and edit scores (soft-delete + an audit log are the safety net).

## Features

- **Fast courtside entry** — tap four players into two teams, the fifth auto-rests, punch in the score, save.
- **Fair Elo-style rating** — ranks everyone even when people play different numbers of games, and accounts for who you beat. Editing or deleting any past game recomputes everything correctly.
- **Leaderboard** with session-over-session rank movement and streaks.
- **Rivalries** — a head-to-head results matrix (record when on opposite teams).
- **Chemistry** — best/worst partnerships and a same-team results matrix.
- **Badges** — On Fire, Giant-Killer, Perfect Game, MVP of the Day/Week, and more.
- **Player profiles** — rating-over-time chart, recent form, partnerships, badges.
- **Mobile-first**, installable to your home screen.

## Tech

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres) · Recharts. The whole app is derived from raw `games` rows by one pure module, `lib/stats/computeAll.ts`, which is covered by unit tests (`npm test`).

## Quick start (local)

1. **Create a Supabase project** (free tier) at [supabase.com](https://supabase.com).
2. In the Supabase **SQL Editor**, paste and run [`supabase/schema.sql`](supabase/schema.sql). It creates the tables, policies, and seeds five placeholder players you can rename in-app.
3. Copy your credentials into `.env.local` (see `.env.example`):
   ```bash
   cp .env.example .env.local
   # then fill in:
   # NEXT_PUBLIC_SUPABASE_URL=...        (Project Settings → API → Project URL)
   # NEXT_PUBLIC_SUPABASE_ANON_KEY=...   (Project Settings → API → anon public key)
   ```
4. Install and run:
   ```bash
   npm install
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new) (Next.js is detected automatically).
3. Add the two env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) for Production **and** Preview.
4. Deploy, then share the URL (and add it to your phone's home screen).

> One-click button (replace `YOUR_GITHUB_REPO` with your repo URL):
>
> `https://vercel.com/new/clone?repository-url=YOUR_GITHUB_REPO&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY`

## How the rating works

Each player has an Elo rating starting at **1000**. A team's rating is the average of its two players. After each game both winners gain (and both losers lose) the same amount, scaled by a K-factor that's larger while a player is still new (under 10 games) so ratings settle quickly. The rating is recomputed from the full game history on every change, so edits and deletes are always consistent. Margin of victory is tracked but not yet applied (a one-line switch in `lib/stats/config.ts`).

## A note on access

There is no authentication by design — the link is the key. Anyone who has it can add, edit, and delete games. That's the right trade-off for a private group, but **don't post the URL publicly.** Every change is recorded in an append-only `game_events` audit log, and deletes are soft (recoverable in the database). Real per-player login is a documented future upgrade.

## Scripts

```bash
npm run dev         # local dev server
npm run build       # production build
npm test            # run the rating/stats engine unit tests
npm run typecheck   # tsc --noEmit
```

## Config

Rating, badge thresholds, and other knobs live in [`lib/stats/config.ts`](lib/stats/config.ts). The default date for new games uses the `Asia/Kolkata` timezone (`todayISO` in `lib/format.ts`) — change it if your group plays elsewhere. The date is editable on every entry anyway.
