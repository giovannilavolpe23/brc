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
  | "custom";

export type GradientDirection = "135deg" | "45deg" | "180deg" | "90deg";
export type AppearanceIntensity = "soft" | "normal" | "strong";
export type VisualStyle = "gradient" | "glass" | "glow";
export type AvatarBorderStyle = "solid" | "gradient" | "none";

export type UserAppearance = {
  preset: AppearancePreset;
  primaryColor: string;
  secondaryColor: string;
  gradientDirection: GradientDirection;
  intensity: AppearanceIntensity;
  visualStyle: VisualStyle;
  avatarBorderStyle: AvatarBorderStyle;
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
};

const PRESETS = new Set<AppearancePreset>([...Object.keys(APPEARANCE_PRESETS), "custom"] as AppearancePreset[]);
const DIRECTIONS = new Set<GradientDirection>(["135deg", "45deg", "180deg", "90deg"]);
const INTENSITIES = new Set<AppearanceIntensity>(["soft", "normal", "strong"]);
const VISUAL_STYLES = new Set<VisualStyle>(["gradient", "glass", "glow"]);
const AVATAR_BORDER_STYLES = new Set<AvatarBorderStyle>(["solid", "gradient", "none"]);
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
  if (JSON.stringify(raw).length > 1200) throw new AppearanceValidationError("payload_too_large");

  const preset = parseEnum(raw.preset, PRESETS, "invalid_preset");
  const gradientDirection = parseEnum(raw.gradientDirection, DIRECTIONS, "invalid_gradient_direction");
  const intensity = parseEnum(raw.intensity, INTENSITIES, "invalid_intensity");
  const visualStyle = parseEnum(raw.visualStyle, VISUAL_STYLES, "invalid_visual_style");
  const avatarBorderStyle = parseEnum(raw.avatarBorderStyle, AVATAR_BORDER_STYLES, "invalid_avatar_border_style");
  const primaryColor = parseHexColor(raw.primaryColor, "invalid_primary_color");
  const secondaryColor = parseHexColor(raw.secondaryColor, "invalid_secondary_color");

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
  };
}

function parseEnum<T extends string>(value: unknown, allowed: Set<T>, error: string): T {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new AppearanceValidationError(error);
  }
  return value as T;
}

function parseHexColor(value: unknown, error: string): string {
  if (typeof value !== "string" || !HEX_COLOR.test(value.trim())) {
    throw new AppearanceValidationError(error);
  }
  return value.trim().toUpperCase();
}
