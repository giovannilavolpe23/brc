alter table money_movements
  add column if not exists is_demo boolean not null default false;

alter table daily_entries
  add column if not exists is_demo boolean not null default false;

alter table survey_votes
  add column if not exists is_demo boolean not null default false;

alter table previas
  add column if not exists is_demo boolean not null default false;

create index if not exists money_movements_is_demo_movement_date_idx
  on money_movements(is_demo, movement_date);

create index if not exists daily_entries_is_demo_date_key_idx
  on daily_entries(is_demo, date_key);

create index if not exists survey_votes_is_demo_date_key_idx
  on survey_votes(is_demo, date_key);

create index if not exists previas_is_demo_occurred_at_idx
  on previas(is_demo, occurred_at);
