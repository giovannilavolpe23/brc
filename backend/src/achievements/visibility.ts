import type { AuthUser } from "../auth/types";

const GIO_LEGACY_ID = "gio";

export function canViewPrivateAchievements(user: Pick<AuthUser, "legacyId">): boolean {
  return user.legacyId.toLowerCase() === GIO_LEGACY_ID;
}
