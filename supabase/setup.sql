-- ISLND accounts on Supabase. Run this once in your project's SQL editor (Database, SQL editor, New query).
-- Then, in Authentication > Sign In / Providers > Email, turn OFF "Confirm email" (usernames become
-- made-up addresses like hana@players.islnd.game, which can't receive mail).

-- each player's save: one row, readable and writable only by that player
create table if not exists public.islnd_saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  username   text not null,
  data       text not null,          -- the save, gzipped and base64-encoded by the game
  z          text not null default '', -- 'gz' when data is gzipped
  updated_at timestamptz not null default now()
);

alter table public.islnd_saves enable row level security;

drop policy if exists "read own save" on public.islnd_saves;
drop policy if exists "add own save" on public.islnd_saves;
drop policy if exists "change own save" on public.islnd_saves;
drop policy if exists "delete own save" on public.islnd_saves;

create policy "read own save" on public.islnd_saves for select to authenticated using ((select auth.uid()) = user_id);
create policy "add own save" on public.islnd_saves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "change own save" on public.islnd_saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own save" on public.islnd_saves for delete to authenticated using ((select auth.uid()) = user_id);
