create extension if not exists pgcrypto;

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_key_not_blank check (btrim(key) <> ''),
  constraint roles_name_not_blank check (btrim(name) <> '')
);

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permissions_key_not_blank check (btrim(key) <> '')
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  legacy_id text not null unique,
  display_name text not null,
  password_hash text not null,
  role_id uuid not null references roles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_legacy_id_not_blank check (btrim(legacy_id) <> ''),
  constraint users_display_name_not_blank check (btrim(display_name) <> ''),
  constraint users_password_hash_not_blank check (btrim(password_hash) <> ''),
  constraint users_password_hash_bcrypt check (password_hash ~ '^\$2[aby]\$[0-9]{2}\$.{53}$')
);

create table if not exists user_permissions (
  user_id uuid not null references users(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, permission_id)
);

create index if not exists users_role_id_idx on users(role_id);
create index if not exists user_permissions_permission_id_idx on user_permissions(permission_id);
