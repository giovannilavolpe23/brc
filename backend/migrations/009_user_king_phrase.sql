alter table user_appearances
  add column if not exists king_phrase text;

alter table user_appearances
  drop constraint if exists user_appearances_king_phrase_check;

alter table user_appearances
  add constraint user_appearances_king_phrase_check
  check (
    king_phrase is null
    or (
      king_phrase = btrim(king_phrase)
      and length(king_phrase) between 3 and 80
    )
  );
