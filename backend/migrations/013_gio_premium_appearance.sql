alter table user_appearances
  add column if not exists premium_glow text,
  add column if not exists premium_shadow text,
  add column if not exists premium_border text,
  add column if not exists premium_intensity text;

alter table user_appearances
  drop constraint if exists user_appearances_preset_check,
  drop constraint if exists user_appearances_visual_style_check,
  drop constraint if exists user_appearances_avatar_border_style_check,
  drop constraint if exists user_appearances_premium_glow_check,
  drop constraint if exists user_appearances_premium_shadow_check,
  drop constraint if exists user_appearances_premium_border_check,
  drop constraint if exists user_appearances_premium_intensity_check;

alter table user_appearances
  add constraint user_appearances_preset_check check (
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
      'royal_gold',
      'golden_power',
      'imperial',
      'ultra_glow',
      'dark_crown',
      'custom'
    )
  ),
  add constraint user_appearances_visual_style_check check (visual_style in ('gradient', 'glass', 'glow', 'royal', 'premium')),
  add constraint user_appearances_avatar_border_style_check check (avatar_border_style in ('solid', 'gradient', 'none', 'gold', 'bright_gradient')),
  add constraint user_appearances_premium_glow_check check (premium_glow is null or premium_glow in ('off', 'soft', 'strong')),
  add constraint user_appearances_premium_shadow_check check (premium_shadow is null or premium_shadow in ('normal', 'deep')),
  add constraint user_appearances_premium_border_check check (premium_border is null or premium_border in ('none', 'gold', 'bright_gradient')),
  add constraint user_appearances_premium_intensity_check check (premium_intensity is null or premium_intensity in ('normal', 'bright', 'ultra'));
