alter table daily_entries
  add column if not exists boliche_entry_time time;

update daily_entries
set boliche_entry_time = time '01:00'
where boliche_did_not_go = false
  and boliche_entry_time is null;

alter table daily_entries
  drop constraint if exists daily_entries_boliche_closed_club_consistent;

alter table daily_entries
  drop constraint if exists daily_entries_boliche_times_consistent;

alter table daily_entries
  add constraint daily_entries_boliche_times_consistent check (
    (
      boliche_did_not_go = true
      and boliche_entry_time is null
      and boliche_exit_time is null
      and boliche_closed_club = false
    )
    or (
      boliche_did_not_go = false
      and boliche_entry_time is not null
      and (
        (
          boliche_closed_club = true
          and boliche_exit_time is null
          and boliche_entry_time < time '06:45'
        )
        or (
          boliche_closed_club = false
          and boliche_exit_time is not null
          and boliche_exit_time > boliche_entry_time
        )
      )
    )
  ) not valid;

insert into achievement_resolutions (achievement_key, achievement_type, unlocked_date, is_duplicate, is_demo, created_at)
select 'first_three_closed_clubs', achievement_type, unlocked_date, is_duplicate, is_demo, created_at
from achievement_resolutions
where achievement_key = 'first_four_closed_clubs'
on conflict (achievement_key) do nothing;

insert into achievement_unlocks (
  achievement_key,
  user_id,
  achievement_type,
  unlocked_date,
  is_duplicate,
  revealed_at,
  is_demo,
  created_at
)
select
  'first_three_closed_clubs',
  user_id,
  achievement_type,
  unlocked_date,
  is_duplicate,
  revealed_at,
  is_demo,
  created_at
from achievement_unlocks
where achievement_key = 'first_four_closed_clubs'
on conflict (achievement_key, user_id) do nothing;

delete from achievement_unlocks
where achievement_key = 'first_four_closed_clubs';

delete from achievement_resolutions
where achievement_key = 'first_four_closed_clubs';
