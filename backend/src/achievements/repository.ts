import { pool } from "../db/pool";
import { ACHIEVEMENTS, ACHIEVEMENT_BY_KEY } from "./definitions";
import type { AchievementUnlock, AdminAchievement } from "./types";

type AchievementUnlockRow = {
  achievement_key: string;
  achievement_type: "unique" | "secret";
  unlocked_date: string | Date;
  is_duplicate: boolean;
  revealed_at: string | Date | null;
  user_id: string;
  legacy_id: string;
  display_name: string;
};

export type AchievementsRepository = {
  listVisible(userId: string): Promise<AchievementUnlock[]>;
  listPendingSecretReveals(userId: string): Promise<AchievementUnlock[]>;
  markSecretRevealed(userId: string, achievementKey: string): Promise<boolean>;
  listAdmin(): Promise<AdminAchievement[]>;
};

export const postgresAchievementsRepository: AchievementsRepository = {
  async listVisible(userId) {
    const result = await pool.query<AchievementUnlockRow>(
      `
        select achievement_unlocks.achievement_key,
               achievement_unlocks.achievement_type,
               achievement_unlocks.unlocked_date,
               achievement_unlocks.is_duplicate,
               achievement_unlocks.revealed_at,
               users.id as user_id,
               users.legacy_id,
               users.display_name
        from achievement_unlocks
        join users on users.id = achievement_unlocks.user_id
        where achievement_unlocks.achievement_type = 'unique'
           or (achievement_unlocks.achievement_type = 'secret' and achievement_unlocks.user_id = $1)
        order by achievement_unlocks.unlocked_date, achievement_unlocks.created_at, users.display_name
      `,
      [userId]
    );
    return result.rows.map(toAchievementUnlock).filter(Boolean) as AchievementUnlock[];
  },

  async listPendingSecretReveals(userId) {
    const result = await pool.query<AchievementUnlockRow>(
      `
        select achievement_unlocks.achievement_key,
               achievement_unlocks.achievement_type,
               achievement_unlocks.unlocked_date,
               achievement_unlocks.is_duplicate,
               achievement_unlocks.revealed_at,
               users.id as user_id,
               users.legacy_id,
               users.display_name
        from achievement_unlocks
        join users on users.id = achievement_unlocks.user_id
        where achievement_unlocks.achievement_type = 'secret'
          and achievement_unlocks.user_id = $1
          and achievement_unlocks.revealed_at is null
        order by achievement_unlocks.unlocked_date, achievement_unlocks.created_at
      `,
      [userId]
    );
    return result.rows.map(toAchievementUnlock).filter(Boolean) as AchievementUnlock[];
  },

  async markSecretRevealed(userId, achievementKey) {
    const result = await pool.query(
      `
        update achievement_unlocks
        set revealed_at = coalesce(revealed_at, now())
        where achievement_key = $1
          and user_id = $2
          and achievement_type = 'secret'
      `,
      [achievementKey, userId]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async listAdmin() {
    const result = await pool.query<AchievementUnlockRow>(
      `
        select achievement_unlocks.achievement_key,
               achievement_unlocks.achievement_type,
               achievement_unlocks.unlocked_date,
               achievement_unlocks.is_duplicate,
               achievement_unlocks.revealed_at,
               users.id as user_id,
               users.legacy_id,
               users.display_name
        from achievement_unlocks
        join users on users.id = achievement_unlocks.user_id
        order by achievement_unlocks.unlocked_date, achievement_unlocks.created_at, users.display_name
      `
    );
    const rowsByKey = new Map<string, AchievementUnlock[]>();
    result.rows.forEach((row) => {
      const unlock = toAchievementUnlock(row);
      if (!unlock) return;
      rowsByKey.set(unlock.key, [...(rowsByKey.get(unlock.key) ?? []), unlock]);
    });

    return ACHIEVEMENTS.map((definition) => {
      const unlocks = rowsByKey.get(definition.key) ?? [];
      return {
        key: definition.key,
        type: definition.type,
        name: definition.name,
        description: definition.description,
        condition: definition.condition,
        status: unlocks.length ? "unlocked" : "blocked",
        unlockedDate: unlocks[0]?.unlockedDate ?? null,
        isDuplicate: unlocks.some((unlock) => unlock.isDuplicate),
        winners: unlocks.map((unlock) => unlock.user),
      };
    });
  },
};

function toAchievementUnlock(row: AchievementUnlockRow): AchievementUnlock | null {
  const definition = ACHIEVEMENT_BY_KEY.get(row.achievement_key);
  if (!definition) return null;
  return {
    key: row.achievement_key,
    type: row.achievement_type,
    name: definition.name,
    description: definition.description,
    condition: definition.condition,
    unlockedDate: toDateOnly(row.unlocked_date),
    isDuplicate: row.is_duplicate,
    revealedAt: row.revealed_at ? toIso(row.revealed_at) : null,
    user: {
      id: row.user_id,
      legacyId: row.legacy_id,
      displayName: row.display_name,
    },
  };
}

function toDateOnly(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
