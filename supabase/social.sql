-- Hustle & Heart Motivation — social features (3.0)
-- Run ONCE in the Supabase SQL editor, AFTER schema.sql.
--
-- What this creates:
--   social_invites          one-time invite codes (accepted via RPC only)
--   social_partners         one partner per user (created by the RPC)
--   social_streaks          each user's current streak, readable by their partner
--   social_challenges       7-day shared challenges (pack themes)
--   social_challenge_days   per-day check-ins inside a challenge
--   social_encouragements   short notes between partners (280 chars max)
--
-- Row Level Security: a user can only ever see rows they belong to.
-- The invite flow goes through accept_partner_invite (SECURITY DEFINER)
-- so invite codes are never listable by other users.
--
-- NOTE: the quotes table from schema.sql was never applied to the live
-- project (Nov 24, 2026 check: REST returns PGRST205 for public.quotes).
-- Run schema.sql first, then this file, or the app's remote features
-- (quotes + social) keep falling back to local-only mode.

create table if not exists public.social_invites (
  code text primary key,
  inviter_id uuid not null references auth.users (id) on delete cascade,
  inviter_name text,
  used_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.social_partners (
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  constraint partners_ordered check (user_a < user_b)
);

create table if not exists public.social_streaks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  streak integer not null default 0,
  last_open date,
  display_name text,
  updated_at timestamptz not null default now()
);

create table if not exists public.social_challenges (
  id uuid primary key default gen_random_uuid(),
  pack_id text not null,
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  started_on date not null default CURRENT_DATE,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.social_challenge_days (
  challenge_id uuid not null references public.social_challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day integer not null check (day between 1 and 7),
  done_at timestamptz not null default now(),
  primary key (challenge_id, user_id, day)
);

create table if not exists public.social_encouragements (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references auth.users (id) on delete cascade,
  to_id uuid not null references auth.users (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 280),
  created_at timestamptz not null default now(),
  read boolean not null default false
);

alter table public.social_invites enable row level security;
alter table public.social_partners enable row level security;
alter table public.social_streaks enable row level security;
alter table public.social_challenges enable row level security;
alter table public.social_challenge_days enable row level security;
alter table public.social_encouragements enable row level security;

-- Invites: you can create your own; nobody can list them (acceptance
-- goes through the RPC below, which is the only reader).
drop policy if exists "invites_insert_own" on public.social_invites;
create policy "invites_insert_own" on public.social_invites
  for insert with check (inviter_id = auth.uid());

-- Partners: readable/deletable only by the two people in the row.
-- Rows are created by the RPC, never by direct insert.
drop policy if exists "partners_select_own" on public.social_partners;
create policy "partners_select_own" on public.social_partners
  for select using (auth.uid() = user_a or auth.uid() = user_b);
drop policy if exists "partners_delete_own" on public.social_partners;
create policy "partners_delete_own" on public.social_partners
  for delete using (auth.uid() = user_a or auth.uid() = user_b);

-- Streaks: anyone can read their partner's row; you can only write yours.
drop policy if exists "streaks_select" on public.social_streaks;
create policy "streaks_select" on public.social_streaks
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.social_partners p
      where (p.user_a = auth.uid() and p.user_b = social_streaks.user_id)
         or (p.user_b = auth.uid() and p.user_a = social_streaks.user_id)
    )
  );
drop policy if exists "streaks_write_own" on public.social_streaks;
create policy "streaks_write_own" on public.social_streaks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Challenges: only the two participants, for every operation.
drop policy if exists "challenges_all_members" on public.social_challenges;
create policy "challenges_all_members" on public.social_challenges
  for all using (auth.uid() = user_a or auth.uid() = user_b)
  with check (auth.uid() = user_a or auth.uid() = user_b);

-- Challenge days: only members of the parent challenge.
drop policy if exists "challenge_days_all_members" on public.social_challenge_days;
create policy "challenge_days_all_members" on public.social_challenge_days
  for all using (
    exists (
      select 1 from public.social_challenges c
      where c.id = social_challenge_days.challenge_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.social_challenges c
      where c.id = social_challenge_days.challenge_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

-- Encouragements: send to anyone (as yourself), read only yours.
drop policy if exists "encouragements_insert_own" on public.social_encouragements;
create policy "encouragements_insert_own" on public.social_encouragements
  for insert with check (from_id = auth.uid());
drop policy if exists "encouragements_select_participants" on public.social_encouragements;
create policy "encouragements_select_participants" on public.social_encouragements
  for select using (to_id = auth.uid() or from_id = auth.uid());
drop policy if exists "encouragements_update_read" on public.social_encouragements;
create policy "encouragements_update_read" on public.social_encouragements
  for update using (to_id = auth.uid()) with check (to_id = auth.uid());

-- Accept an invite code: validates server-side, enforces one partner
-- per user, creates the partnership, and marks the invite used.
-- Called as: select accept_partner_invite('ABC123')
create or replace function public.accept_partner_invite(p_code text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_inviter uuid;
  v_me uuid := auth.uid();
  v_a uuid;
  v_b uuid;
begin
  if v_me is null then
    raise exception 'not signed in';
  end if;
  select inviter_id into v_inviter
    from public.social_invites
    where code = upper(trim(p_code)) and used_by is null;
  if v_inviter is null then
    raise exception 'invite not found or already used';
  end if;
  if v_inviter = v_me then
    raise exception 'cannot accept your own invite';
  end if;
  if exists (
    select 1 from public.social_partners
    where user_a = v_me or user_b = v_me
  ) then
    raise exception 'you already have a partner';
  end if;
  if exists (
    select 1 from public.social_partners
    where user_a = v_inviter or user_b = v_inviter
  ) then
    raise exception 'inviter already has a partner';
  end if;
  v_a := least(v_me, v_inviter);
  v_b := greatest(v_me, v_inviter);
  insert into public.social_partners (user_a, user_b) values (v_a, v_b);
  update public.social_invites set used_by = v_me where code = upper(trim(p_code));
  return v_inviter;
end;
$$;
