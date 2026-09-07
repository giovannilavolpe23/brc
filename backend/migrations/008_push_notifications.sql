create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_not_empty check (length(trim(endpoint)) > 0),
  constraint push_subscriptions_p256dh_not_empty check (length(trim(p256dh)) > 0),
  constraint push_subscriptions_auth_not_empty check (length(trim(auth)) > 0)
);

create index if not exists push_subscriptions_user_id_idx
  on push_subscriptions(user_id);

create table if not exists push_daily_reminders (
  date_key date not null,
  user_id uuid not null references users(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (date_key, user_id)
);

create table if not exists push_stats_ready_notifications (
  date_key date primary key,
  sent_at timestamptz not null default now()
);
