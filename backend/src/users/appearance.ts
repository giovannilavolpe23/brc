export type AppearancePreset =
  | "aurora"
  | "glaciar"
  | "medianoche"
  | "neon_frio"
  | "violeta_polar"
  | "rosa_hielo"
  | "aurora_verde"
  | "oceano"
  | "royal"
  | "fuego_frio"
  | "cyber_ice"
  | "esmeralda_nocturna"
  | "royal_gold"
  | "golden_power"
  | "imperial"
  | "ultra_glow"
  | "dark_crown"
  | "custom";

export type GradientDirection = "135deg" | "45deg" | "180deg" | "90deg";
export type AppearanceIntensity = "soft" | "normal" | "strong";
export type VisualStyle = "gradient" | "glass" | "glow" | "royal" | "premium";
export type AvatarBorderStyle = "solid" | "gradient" | "none" | "gold" | "bright_gradient";
export type PremiumGlow = "off" | "soft" | "strong";
export type PremiumShadow = "normal" | "deep";
export type PremiumBorder = "none" | "gold" | "bright_gradient";
export type PremiumIntensity = "normal" | "bright" | "ultra";

export type UserAppearance = {
  preset: AppearancePreset;
  primaryColor: string;
  secondaryColor: string;
  gradientDirection: GradientDirection;
  intensity: AppearanceIntensity;
  visualStyle: VisualStyle;
  avatarBorderStyle: AvatarBorderStyle;
  kingPhrase: string | null;
  premiumGlow?: PremiumGlow | null;
  premiumShadow?: PremiumShadow | null;
  premiumBorder?: PremiumBorder | null;
  premiumIntensity?: PremiumIntensity | null;
};

export const APPEARANCE_PRESETS: Record<Exclude<AppearancePreset, "custom">, Pick<UserAppearance, "primaryColor" | "secondaryColor">> = {
  aurora: { primaryColor: "#4CC9F0", secondaryColor: "#7B61FF" },
  glaciar: { primaryColor: "#38BDF8", secondaryColor: "#A5F3FC" },
  medianoche: { primaryColor: "#2563EB", secondaryColor: "#1E1B4B" },
  neon_frio: { primaryColor: "#22D3EE", secondaryColor: "#6366F1" },
  violeta_polar: { primaryColor: "#8B5CF6", secondaryColor: "#C084FC" },
  rosa_hielo: { primaryColor: "#EC4899", secondaryColor: "#A78BFA" },
  aurora_verde: { primaryColor: "#2DD4BF", secondaryColor: "#22C55E" },
  oceano: { primaryColor: "#0EA5E9", secondaryColor: "#14B8A6" },
  royal: { primaryColor: "#4F46E5", secondaryColor: "#9333EA" },
  fuego_frio: { primaryColor: "#EF4444", secondaryColor: "#8B5CF6" },
  cyber_ice: { primaryColor: "#06B6D4", secondaryColor: "#3B82F6" },
  esmeralda_nocturna: { primaryColor: "#10B981", secondaryColor: "#0F766E" },
  royal_gold: { primaryColor: "#08111F", secondaryColor: "#D6B25E" },
  golden_power: { primaryColor: "#111827", secondaryColor: "#E7C873" },
  imperial: { primaryColor: "#24104F", secondaryColor: "#D9B76A" },
  ultra_glow: { primaryColor: "#0F172A", secondaryColor: "#7DD3FC" },
  dark_crown: { primaryColor: "#050B14", secondaryColor: "#B9944B" },
};

const GIO_LEGACY_ID = "gio";
const GIO_ONLY_PRESETS = new Set<AppearancePreset>(["royal_gold", "golden_power", "imperial", "ultra_glow", "dark_crown"]);
const PRESETS = new Set<AppearancePreset>([...Object.keys(APPEARANCE_PRESETS), "custom"] as AppearancePreset[]);
const DIRECTIONS = new Set<GradientDirection>(["135deg", "45deg", "180deg", "90deg"]);
const INTENSITIES = new Set<AppearanceIntensity>(["soft", "normal", "strong"]);
const VISUAL_STYLES = new Set<VisualStyle>(["gradient", "glass", "glow", "royal", "premium"]);
const AVATAR_BORDER_STYLES = new Set<AvatarBorderStyle>(["solid", "gradient", "none", "gold", "bright_gradient"]);
const PREMIUM_GLOWS = new Set<PremiumGlow>(["off", "soft", "strong"]);
const PREMIUM_SHADOWS = new Set<PremiumShadow>(["normal", "deep"]);
const PREMIUM_BORDERS = new Set<PremiumBorder>(["none", "gold", "bright_gradient"]);
const PREMIUM_INTENSITIES = new Set<PremiumIntensity>(["normal", "bright", "ultra"]);
const HEX_COLOR = /^#[0-9A-F]{6}$/i;

export class AppearanceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppearanceValidationError";
  }
}

export function parseAppearanceInput(body: unknown): UserAppearance {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppearanceValidationError("invalid_body");
  }

  const raw = body as Record<string, unknown>;
  if (JSON.stringify(raw).length > 1600) throw new AppearanceValidationError("payload_too_large");

  const preset = parseEnum(raw.preset, PRESETS, "invalid_preset");
  const gradientDirection = parseEnum(raw.gradientDirection, DIRECTIONS, "invalid_gradient_direction");
  const intensity = parseEnum(raw.intensity, INTENSITIES, "invalid_intensity");
  const visualStyle = parseEnum(raw.visualStyle, VISUAL_STYLES, "invalid_visual_style");
  const avatarBorderStyle = parseEnum(raw.avatarBorderStyle, AVATAR_BORDER_STYLES, "invalid_avatar_border_style");
  const primaryColor = parseHexColor(raw.primaryColor, "invalid_primary_color");
  const secondaryColor = parseHexColor(raw.secondaryColor, "invalid_secondary_color");
  const kingPhrase = parseKingPhrase(raw.kingPhrase);
  const premiumGlow = parseOptionalEnum(raw.premiumGlow, PREMIUM_GLOWS, "invalid_premium_glow");
  const premiumShadow = parseOptionalEnum(raw.premiumShadow, PREMIUM_SHADOWS, "invalid_premium_shadow");
  const premiumBorder = parseOptionalEnum(raw.premiumBorder, PREMIUM_BORDERS, "invalid_premium_border");
  const premiumIntensity = parseOptionalEnum(raw.premiumIntensity, PREMIUM_INTENSITIES, "invalid_premium_intensity");

  if (preset !== "custom") {
    const presetColors = APPEARANCE_PRESETS[preset];
    if (primaryColor !== presetColors.primaryColor || secondaryColor !== presetColors.secondaryColor) {
      throw new AppearanceValidationError("preset_color_mismatch");
    }
  }

  return {
    preset,
    primaryColor,
    secondaryColor,
    gradientDirection,
    intensity,
    visualStyle,
    avatarBorderStyle,
    kingPhrase,
    ...(premiumGlow ? { premiumGlow } : {}),
    ...(premiumShadow ? { premiumShadow } : {}),
    ...(premiumBorder ? { premiumBorder } : {}),
    ...(premiumIntensity ? { premiumIntensity } : {}),
  };
}

export function assertAppearanceAllowedForUser(appearance: UserAppearance, user: { legacyId: string }): void {
  if (appearanceRequiresGio(appearance) && user.legacyId.toLowerCase() !== GIO_LEGACY_ID) {
    throw new AppearanceValidationError("gio_appearance_only");
  }
}

function appearanceRequiresGio(appearance: UserAppearance): boolean {
  return (
    GIO_ONLY_PRESETS.has(appearance.preset) ||
    appearance.visualStyle === "royal" ||
    appearance.visualStyle === "premium" ||
    appearance.avatarBorderStyle === "gold" ||
    appearance.avatarBorderStyle === "bright_gradient" ||
    Boolean(appearance.premiumGlow && appearance.premiumGlow !== "off") ||
    Boolean(appearance.premiumShadow && appearance.premiumShadow !== "normal") ||
    Boolean(appearance.premiumBorder && appearance.premiumBorder !== "none") ||
    Boolean(appearance.premiumIntensity && appearance.premiumIntensity !== "normal")
  );
}

function parseEnum<T extends string>(value: unknown, allowed: Set<T>, error: string): T {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new AppearanceValidationError(error);
  }
  return value as T;
}

function parseOptionalEnum<T extends string>(value: unknown, allowed: Set<T>, error: string): T | null {
  if (value === undefined || value === null || value === "") return null;
  return parseEnum(value, allowed, error);
}

function parseHexColor(value: unknown, error: string): string {
  if (typeof value !== "string" || !HEX_COLOR.test(value.trim())) {
    throw new AppearanceValidationError(error);
  }
  return value.trim().toUpperCase();
}

function parseKingPhrase(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new AppearanceValidationError("invalid_king_phrase");
  const trimmed = value.trim();
  if (!trimmed) throw new AppearanceValidationError("invalid_king_phrase");
  if (trimmed.length < 3) throw new AppearanceValidationError("king_phrase_too_short");
  if (trimmed.length > 80) throw new AppearanceValidationError("king_phrase_too_long");
  return trimmed;
}
