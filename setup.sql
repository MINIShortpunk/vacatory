-- Vac Attack database setup.
-- Paste this whole file into Supabase's SQL editor and click Run, once.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean default false
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  offices text,
  practice_areas text,
  firm_size text,
  training_initiatives text,
  secondments text,
  career_progression text,
  culture text,
  tech_innovation text,
  main_clients text,
  dei_csr text,
  eligibility text,
  summer_open date,
  summer_close date,
  winter_open date,
  winter_close date,
  application_questions jsonb default '[]',
  custom_fields jsonb default '[]',
  news jsonb default '[]',
  notes text,
  created_at timestamptz default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  date date,
  location text,
  url text,
  notes text
);

create table user_favorites (
  user_id uuid references auth.users(id) on delete cascade,
  firm_id uuid references firms(id) on delete cascade,
  primary key (user_id, firm_id)
);

create table user_notes (
  user_id uuid references auth.users(id) on delete cascade,
  firm_id uuid references firms(id) on delete cascade,
  reasons text default '',
  questions text default '',
  primary key (user_id, firm_id)
);

create table user_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  subject text not null,
  date date not null
);

-- Row Level Security: this is what makes personal data actually private.
alter table profiles enable row level security;
alter table firms enable row level security;
alter table events enable row level security;
alter table user_favorites enable row level security;
alter table user_notes enable row level security;
alter table user_exams enable row level security;

create policy "profiles: read own" on profiles for select using (auth.uid() = id);
create policy "profiles: update own" on profiles for update using (auth.uid() = id);

create policy "firms: everyone can read" on firms for select using (true);
create policy "firms: admins can write" on firms for all using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);

create policy "events: everyone can read" on events for select using (true);
create policy "events: admins can write" on events for all using (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_admin = true)
);

create policy "favorites: only the owner" on user_favorites for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notes: only the owner" on user_notes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exams: only the owner" on user_exams for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
