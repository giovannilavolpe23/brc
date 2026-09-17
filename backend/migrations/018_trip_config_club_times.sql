create table if not exists trip_config (
  id boolean primary key default true,
  club_open_time time not null default time '01:00',
  club_close_time time not null default time '06:45',
  updated_at timestamptz not null default now(),
  constraint trip_config_singleton check (id = true),
  constraint trip_config_club_times_different check (club_open_time <> club_close_time)
);

insert into trip_config (id, club_open_time, club_close_time)
values (true, time '01:00', time '06:45')
on conflict (id) do nothing;

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
        )
        or (
          boliche_closed_club = false
          and boliche_exit_time is not null
        )
      )
    )
  ) not valid;
