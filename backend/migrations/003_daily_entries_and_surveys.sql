create table if not exists daily_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  date_key date not null,
  sleep_did_not_sleep boolean not null default false,
  sleep_bedtime time,
  sleep_wake time,
  nap_start time,
  nap_end time,
  fifth_meal text,
  bathroom_count integer,
  boliche_did_not_go boolean not null default false,
  boliche_exit_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date_key),
  constraint daily_entries_fifth_meal_valid check (fifth_meal in ('yes', 'no') or fifth_meal is null),
  constraint daily_entries_bathroom_count_valid check (bathroom_count between 0 and 5 or bathroom_count is null),
  constraint daily_entries_sleep_times_consistent check (
    (sleep_did_not_sleep = true and sleep_bedtime is null and sleep_wake is null)
    or sleep_did_not_sleep = false
  ),
  constraint daily_entries_nap_consistent check (
    (nap_start is null and nap_end is null)
    or (nap_start is not null and nap_end is not null and nap_end >= nap_start)
  ),
  constraint daily_entries_boliche_consistent check (
    (boliche_did_not_go = true and boliche_exit_time is null)
    or boliche_did_not_go = false
  )
);

create index if not exists daily_entries_user_id_date_key_idx
  on daily_entries(user_id, date_key desc);

create table if not exists survey_questions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint survey_questions_key_not_blank check (btrim(key) <> ''),
  constraint survey_questions_title_not_blank check (btrim(title) <> '')
);

create table if not exists survey_votes (
  id uuid primary key default gen_random_uuid(),
  survey_question_id uuid not null references survey_questions(id) on delete cascade,
  date_key date not null,
  voter_user_id uuid not null references users(id) on delete cascade,
  voted_user_id uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (survey_question_id, date_key, voter_user_id),
  constraint survey_votes_no_self_vote check (voter_user_id <> voted_user_id)
);

create index if not exists survey_votes_voted_user_id_idx
  on survey_votes(voted_user_id);

insert into survey_questions (key, title)
values ('destroyed_vote', 'Quien estuvo mas destruido anoche')
on conflict (key) do update
set title = excluded.title,
    updated_at = now();
