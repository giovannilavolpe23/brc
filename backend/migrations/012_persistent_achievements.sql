create table if not exists achievement_resolutions (
  achievement_key text primary key,
  achievement_type text not null check (achievement_type in ('unique', 'secret')),
  unlocked_date date not null,
  is_duplicate boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists achievement_unlocks (
  achievement_key text not null references achievement_resolutions(achievement_key) on delete cascade,
  user_id uuid not null references users(id) on delete restrict,
  achievement_type text not null check (achievement_type in ('unique', 'secret')),
  unlocked_date date not null,
  is_duplicate boolean not null default false,
  is_demo boolean not null default false,
  revealed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (achievement_key, user_id)
);

create index if not exists achievement_unlocks_user_id_idx on achievement_unlocks(user_id);
create index if not exists achievement_unlocks_secret_reveals_idx
  on achievement_unlocks(user_id, revealed_at)
  where achievement_type = 'secret';
