alter table daily_entries
  add column if not exists boliche_closed_club boolean not null default false;

alter table daily_entries
  drop constraint if exists daily_entries_boliche_closed_club_consistent;

alter table daily_entries
  add constraint daily_entries_boliche_closed_club_consistent check (
    (boliche_did_not_go = true and boliche_closed_club = false and boliche_exit_time is null)
    or (
      boliche_did_not_go = false
      and (boliche_closed_club = false or boliche_exit_time is null)
    )
  );
