alter table money_movements
  add column if not exists legacy_id text;

create unique index if not exists money_movements_user_id_legacy_id_idx
  on money_movements(user_id, legacy_id)
  where legacy_id is not null;
