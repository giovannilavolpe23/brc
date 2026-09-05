create table if not exists user_appearances (
  user_id uuid primary key references users(id) on delete cascade,
  preset text not null,
  primary_color text not null,
  secondary_color text not null,
  gradient_direction text not null,
  intensity text not null,
  visual_style text not null,
  avatar_border_style text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_appearances_preset_check check (
    preset in (
      'aurora',
      'glaciar',
      'medianoche',
      'neon_frio',
      'violeta_polar',
      'rosa_hielo',
      'aurora_verde',
      'oceano',
      'royal',
      'fuego_frio',
      'cyber_ice',
      'esmeralda_nocturna',
      'custom'
    )
  ),
  constraint user_appearances_primary_color_check check (primary_color ~ '^#[0-9A-F]{6}$'),
  constraint user_appearances_secondary_color_check check (secondary_color ~ '^#[0-9A-F]{6}$'),
  constraint user_appearances_gradient_direction_check check (gradient_direction in ('135deg', '45deg', '180deg', '90deg')),
  constraint user_appearances_intensity_check check (intensity in ('soft', 'normal', 'strong')),
  constraint user_appearances_visual_style_check check (visual_style in ('gradient', 'glass', 'glow')),
  constraint user_appearances_avatar_border_style_check check (avatar_border_style in ('solid', 'gradient', 'none'))
);
