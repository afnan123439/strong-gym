-- Apply once to an existing Strong Gym project.
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('javascript','promise')),
  message text not null check (char_length(message) <= 500),
  source text check (char_length(source) <= 240),
  line integer,
  column_number integer,
  path text check (char_length(path) <= 160),
  user_agent text check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);

alter table public.client_errors enable row level security;
drop policy if exists "client errors own insert" on public.client_errors;
drop policy if exists "client errors manager read" on public.client_errors;
create policy "client errors own insert" on public.client_errors for insert to authenticated with check(user_id=(select auth.uid()));
create policy "client errors manager read" on public.client_errors for select to authenticated using(private.is_manager());
grant insert,select on public.client_errors to authenticated;
