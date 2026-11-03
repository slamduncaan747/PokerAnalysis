-- Leakfinder cloud sync: each signed-in user stores their raw hand histories and training
-- progress so every device (computer, phone app) sees the same data. Analysis is recomputed
-- locally from the raw text, so only the original hand history is stored.

create table if not exists public.hands (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  hand_id text not null,                -- e.g. "PokerStars-244123456789", "CoinPoker-160054200061"
  site text not null,
  played_at text,                       -- timestamp as printed by the site (local clock)
  raw text not null check (length(raw) < 200000),
  created_at timestamptz not null default now(),
  primary key (user_id, hand_id)
);
create index if not exists hands_user_created_idx on public.hands (user_id, created_at);

create table if not exists public.training_progress (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row level security: a user can only ever see and change their own rows.
alter table public.hands enable row level security;
alter table public.training_progress enable row level security;

create policy "hands: read own" on public.hands
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "hands: insert own" on public.hands
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "hands: delete own" on public.hands
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "progress: read own" on public.training_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "progress: insert own" on public.training_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "progress: update own" on public.training_progress
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.hands, public.training_progress from anon;
grant select, insert, delete on public.hands to authenticated;
grant select, insert, update on public.training_progress to authenticated;

-- In-app account deletion (required by App Store guideline 5.1.1(v)).
-- Deleting the auth user cascades to hands and training_progress.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
