import { Router, type RequestHandler } from "express";
import { requireAuth, requireRole } from "../auth/middleware";
import { dateKeyDaysBeforeArgentina } from "../dates/trip-date";
import { pool } from "../db/pool";

type DailyProgressUserRow = {
  id: string;
  legacy_id: string;
  display_name: string;
  entry_id: string | null;
};

export type DailyProgressUser = {
  id: string;
  legacyId: string;
  displayName: string;
};

export type DailyProgress = {
  dateKey: string;
  totalActiveUsers: number;
  registeredCount: number;
  pendingCount: number;
  pendingUsers: DailyProgressUser[];
};

export type AdminDailyProgressRepository = {
  getDailyProgress(dateKey: string): Promise<DailyProgress>;
};

export const postgresAdminDailyProgressRepository: AdminDailyProgressRepository = {
  async getDailyProgress(dateKey) {
    const result = await pool.query<DailyProgressUserRow>(
      `
        select users.id,
               users.legacy_id,
               users.display_name,
               daily_entries.id as entry_id
        from users
        left join daily_entries
          on daily_entries.user_id = users.id
         and daily_entries.date_key = $1::date
        where users.is_active = true
        order by users.display_name
      `,
      [dateKey]
    );

    const pendingUsers = result.rows
      .filter((row) => !row.entry_id)
      .map((row) => ({
        id: row.id,
        legacyId: row.legacy_id,
        displayName: row.display_name,
      }));

    return {
      dateKey,
      totalActiveUsers: result.rows.length,
      registeredCount: result.rows.length - pendingUsers.length,
      pendingCount: pendingUsers.length,
      pendingUsers,
    };
  },
};

export function createAdminDailyProgressRouter(
  repository: AdminDailyProgressRepository = postgresAdminDailyProgressRepository,
  authMiddleware: RequestHandler = requireAuth,
  now: () => Date = () => new Date()
): Router {
  const router = Router();

  router.get("/daily-progress", authMiddleware, requireRole("admin"), async (_req, res, next) => {
    try {
      const dateKey = dateKeyDaysBeforeArgentina(1, now());
      res.json(await repository.getDailyProgress(dateKey));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const adminDailyProgressRouter = createAdminDailyProgressRouter();
