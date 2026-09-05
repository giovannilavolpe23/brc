create index if not exists users_active_display_name_lookup_idx
  on users (lower(display_name))
  where is_active = true;
