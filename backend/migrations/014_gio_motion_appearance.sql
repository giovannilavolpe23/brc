alter table user_appearances
  add column if not exists premium_motion text,
  add column if not exists premium_border_animation text,
  add column if not exists premium_shimmer text;

alter table user_appearances
  drop constraint if exists user_appearances_preset_check,
  drop constraint if exists user_appearances_premium_motion_check,
  drop constraint if exists user_appearances_premium_border_animation_check,
  drop constraint if exists user_appearances_premium_shimmer_check;

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
      'royal_motion',
      'aurora_power',
      'golden_crown',
      'energy',
      'custom'
    )
  ),
  add constraint user_appearances_premium_motion_check check (premium_motion is null or premium_motion in ('off', 'soft', 'intense')),
  add constraint user_appearances_premium_border_animation_check check (premium_border_animation is null or premium_border_animation in ('solid', 'gradient', 'animated')),
  add constraint user_appearances_premium_shimmer_check check (premium_shimmer is null or premium_shimmer in ('off', 'subtle'));
