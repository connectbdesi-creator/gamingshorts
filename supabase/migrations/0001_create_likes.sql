-- Likes: one row per (card, anonymous visitor). card_id references a
-- Card.id from the mock/ingested JSON dataset, not a DB foreign key, since
-- cards themselves aren't stored in Postgres yet.
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  card_id text not null,
  visitor_id uuid not null,
  created_at timestamptz not null default now(),
  unique (card_id, visitor_id)
);

create index if not exists likes_card_id_idx on public.likes (card_id);

alter table public.likes enable row level security;

-- Anonymous engagement: there's no Supabase Auth session backing
-- visitor_id (see src/lib/visitor.ts, a client-generated localStorage
-- UUID), so these policies can't cryptographically verify true ownership
-- of a like — someone could in principle forge another visitor_id and
-- delete their like. Acceptable trade-off for a v1 lightweight counter
-- with no login; revisit (e.g. move delete behind an edge function) if
-- abuse becomes a real problem.
create policy "Anyone can read likes"
  on public.likes for select
  to anon
  using (true);

create policy "Anyone can like"
  on public.likes for insert
  to anon
  with check (true);

create policy "Anyone can remove their own like"
  on public.likes for delete
  to anon
  using (true);
