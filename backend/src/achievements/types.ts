import type { AchievementType } from "./definitions";

export type AchievementUnlock = {
  key: string;
  type: AchievementType;
  name: string;
  description: string;
  condition?: string;
  unlockedDate: string;
  isDuplicate: boolean;
  user: {
    id: string;
    legacyId: string;
    displayName: string;
  };
  revealedAt: string | null;
};

export type AdminAchievement = {
  key: string;
  type: AchievementType;
  name: string;
  description: string;
  condition: string;
  status: "blocked" | "unlocked";
  unlockedDate: string | null;
  isDuplicate: boolean;
  winners: AchievementUnlock["user"][];
};

export type SecretAchievementSummary = {
  unlockedCount: number;
  totalCount: number;
};

export type AchievementCandidate = {
  key: string;
  type: AchievementType;
  dateKey: string;
  userIds: string[];
};
