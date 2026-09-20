create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;
create policy "manage own subscriptions"
  on push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists reminder_times (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  time_of_day time not null,
  timezone text not null,
  label text,
  last_sent_on date,
  created_at timestamptz not null default now()
);
alter table reminder_times enable row level security;
create policy "manage own reminders"
  on reminder_times for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);