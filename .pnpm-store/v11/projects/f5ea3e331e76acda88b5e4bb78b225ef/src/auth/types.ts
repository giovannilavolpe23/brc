import type { UserAppearance } from "../users/appearance";

export type AuthUser = {
  id: string;
  legacyId: string;
  displayName: string;
  role: string;
  permissions: string[];
  appearance?: UserAppearance | null;
};

export type UserCredentials = AuthUser & {
  passwordHash: string;
};

export type PublicUser = {
  id: string;
  legacyId: string;
  displayName: string;
  role: string;
  permissions: string[];
  appearance: UserAppearance | null;
};

export function toPublicUser(user: AuthUser): PublicUser {
  return {
    id: user.id,
    legacyId: user.legacyId,
    displayName: user.displayName,
    role: user.role,
    permissions: user.permissions,
    appearance: user.appearance ?? null,
  };
}
