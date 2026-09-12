insert into survey_questions (key, title)
values
  ('most_flirty', '¿Quién fue el más chamuyero anoche?'),
  ('best_outfit', '¿Quién tuvo el mejor outfit anoche?')
on conflict (key) do update
set title = excluded.title,
    is_active = true,
    updated_at = now();
