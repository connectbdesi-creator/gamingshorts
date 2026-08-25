-- Game follows: one row per (visitor, game). game_slug references
-- Card.game from the mock/ingested JSON dataset — there's no games table,
-- since the set of games is derived from whatever cards currently exist
-- (see src/lib/games.ts), not a fixed registry.
create table if not exists public.game_follows (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null,
  game_slug text not null,
  created_at timestamptz not null default now(),
  unique (visitor_id, game_slug)
);

create index if not exists game_follows_game_slug_idx on public.game_follows (game_slug);

alter table public.game_follows enable row level security;

-- Same anonymous-visitor trust model as public.likes (see
-- 0001_create_likes.sql) — visitor_id isn't backed by a real auth
-- session, so these policies can't verify true ownership. Acceptable for
-- a v1 lightweight follow list with no login.
create policy "Anyone can read follows"
  on public.game_follows for select
  to anon
  using (true);

create policy "Anyone can follow a game"
  on public.game_follows for insert
  to anon
  with check (true);

create policy "Anyone can unfollow a game"
  on public.game_follows for delete
  to anon
  using (true);

-- Push subscriptions: one row per (visitor, browser). A visitor could
-- have more than one (multiple devices/browsers), hence no unique
-- constraint beyond the endpoint itself.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_visitor_id_idx on public.push_subscriptions (visitor_id);

alter table public.push_subscriptions enable row level security;

-- Subscriptions are written by the subscribing browser (anon key) but
-- only ever READ by the ingestion pipeline using the service-role key
-- (scripts/ingest/push.ts), which bypasses RLS entirely — so there's no
-- anon "select" policy here. A push subscription's endpoint/keys are
-- meaningless without knowing which visitor_id sent notifications to whom
-- anyway, but this still avoids exposing the full subscription table to
-- anyone holding just the public anon key.
create policy "Anyone can register a push subscription"
  on public.push_subscriptions for insert
  to anon
  with check (true);

create policy "Anyone can remove their own push subscription"
  on public.push_subscriptions for delete
  to anon
  using (true);
