import { pool } from "../db/pool";
import type { UserAppearance } from "./appearance";

export type AppearanceRow = {
  preset: UserAppearance["preset"];
  primary_color: string;
  secondary_color: string;
  gradient_direction: UserAppearance["gradientDirection"];
  intensity: UserAppearance["intensity"];
  visual_style: UserAppearance["visualStyle"];
  avatar_border_style: UserAppearance["avatarBorderStyle"];
};

export type AppearanceRepository = {
  findByUserId(userId: string): Promise<UserAppearance | null>;
  upsertForUser(userId: string, appearance: UserAppearance): Promise<UserAppearance>;
  deleteForUser(userId: string): Promise<void>;
};

export const postgresAppearanceRepository: AppearanceRepository = {
  async findByUserId(userId) {
    const result = await pool.query<AppearanceRow>(
      `
        select preset,
               primary_color,
               secondary_color,
               gradient_direction,
               intensity,
               visual_style,
               avatar_border_style
        from user_appearances
        where user_id = $1
        limit 1
      `,
      [userId]
    );
    return result.rows[0] ? toAppearance(result.rows[0]) : null;
  },

  async upsertForUser(userId, appearance) {
    const result = await pool.query<AppearanceRow>(
      `
        insert into user_appearances (
          user_id,
          preset,
          primary_color,
          secondary_color,
          gradient_direction,
          intensity,
          visual_style,
          avatar_border_style
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        on conflict (user_id) do update
        set preset = excluded.preset,
            primary_color = excluded.primary_color,
            secondary_color = excluded.secondary_color,
            gradient_direction = excluded.gradient_direction,
            intensity = excluded.intensity,
            visual_style = excluded.visual_style,
            avatar_border_style = excluded.avatar_border_style,
            updated_at = now()
        returning preset,
                  primary_color,
                  secondary_color,
                  gradient_direction,
                  intensity,
                  visual_style,
                  avatar_border_style
      `,
      [
        userId,
        appearance.preset,
        appearance.primaryColor,
        appearance.secondaryColor,
        appearance.gradientDirection,
        appearance.intensity,
        appearance.visualStyle,
        appearance.avatarBorderStyle,
      ]
    );
    const saved = toAppearance(result.rows[0]);
    if (!saved) throw new Error("appearance_upsert_failed");
    return saved;
  },

  async deleteForUser(userId) {
    await pool.query("delete from user_appearances where user_id = $1", [userId]);
  },
};

export function toAppearance(row: AppearanceRow | null | undefined): UserAppearance | null {
  if (!row) return null;
  return {
    preset: row.preset,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    gradientDirection: row.gradient_direction,
    intensity: row.intensity,
    visualStyle: row.visual_style,
    avatarBorderStyle: row.avatar_border_style,
  };
}
