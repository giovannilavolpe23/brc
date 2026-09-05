create table if not exists previas (
  id uuid primary key default gen_random_uuid(),
  legacy_id text not null unique,
  creator_user_id uuid not null references users(id) on delete restrict,
  total_amount_pesos integer not null,
  amount_per_participant_pesos integer not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint previas_legacy_id_not_blank check (btrim(legacy_id) <> ''),
  constraint previas_total_amount_positive check (total_amount_pesos > 0),
  constraint previas_amount_per_participant_positive check (amount_per_participant_pesos > 0)
);

create table if not exists previa_products (
  id uuid primary key default gen_random_uuid(),
  previa_id uuid not null references previas(id) on delete cascade,
  legacy_id text,
  name text not null,
  unit_price_pesos integer not null,
  quantity integer not null,
  created_at timestamptz not null default now(),
  constraint previa_products_name_not_blank check (btrim(name) <> ''),
  constraint previa_products_unit_price_positive check (unit_price_pesos > 0),
  constraint previa_products_quantity_positive check (quantity > 0)
);

create table if not exists previa_participants (
  previa_id uuid not null references previas(id) on delete cascade,
  user_id uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (previa_id, user_id)
);

create index if not exists previas_creator_user_id_idx on previas(creator_user_id);
create index if not exists previa_products_previa_id_idx on previa_products(previa_id);
create index if not exists previa_participants_user_id_idx on previa_participants(user_id);
