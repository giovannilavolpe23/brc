create table if not exists initial_balances (
  user_id uuid primary key references users(id) on delete cascade,
  amount_pesos integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint initial_balances_amount_non_negative check (amount_pesos >= 0)
);

create table if not exists money_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null,
  amount_pesos integer not null,
  category text,
  description text,
  movement_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint money_movements_type_valid check (type in ('expense', 'income')),
  constraint money_movements_amount_positive check (amount_pesos > 0),
  constraint money_movements_category_valid check (
    (type = 'income' and category is null)
    or
    (
      type = 'expense'
      and category in (
        'Chocolates',
        'Alcohol',
        'Boliche',
        'Comida',
        'Bebida',
        'Actividades',
        'Otros'
      )
    )
  )
);

create index if not exists money_movements_user_id_movement_date_idx
  on money_movements(user_id, movement_date desc, created_at desc);
