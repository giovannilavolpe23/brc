import { Router, type RequestHandler } from "express";
import type { PoolClient } from "pg";
import { requireAuth, requireRole } from "../auth/middleware";
import { env } from "../config/env";
import { pool } from "../db/pool";

export type DevResetSummary = {
  moneyMovements: number;
  dailyEntries: number;
  surveyVotes: number;
  previas: number;
  previaProducts: number;
  previaParticipants: number;
  initialBalances: 0;
};

export type DevResetRepository = {
  resetData(): Promise<DevResetSummary>;
};

type ResetClient = Pick<PoolClient, "query" | "release">;

export function createPostgresDevResetRepository(
  connect: () => Promise<ResetClient> = () => pool.connect()
): DevResetRepository {
  return {
    async resetData() {
      const client = await connect();
      try {
        await client.query("begin");

        const surveyVotes = await client.query("delete from survey_votes");
        const previaParticipants = await client.query("delete from previa_participants");
        const previaProducts = await client.query("delete from previa_products");
        const previas = await client.query("delete from previas");
        const dailyEntries = await client.query("delete from daily_entries");
        const moneyMovements = await client.query("delete from money_movements");

        await client.query("commit");

        return {
          moneyMovements: moneyMovements.rowCount ?? 0,
          dailyEntries: dailyEntries.rowCount ?? 0,
          surveyVotes: surveyVotes.rowCount ?? 0,
          previas: previas.rowCount ?? 0,
          previaProducts: previaProducts.rowCount ?? 0,
          previaParticipants: previaParticipants.rowCount ?? 0,
          initialBalances: 0,
        };
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

export function createAdminDevRouter(
  repository: DevResetRepository = createPostgresDevResetRepository(),
  authMiddleware: RequestHandler = requireAuth,
  resetPassword: string = env.devResetPassword
): Router {
  const router = Router();

  router.delete("/reset-data", authMiddleware, requireRole("admin"), async (req, res, next) => {
    try {
      const password = parsePassword(req.body);
      if (!resetPassword || password !== resetPassword) {
        res.status(401).json({ error: "invalid_reset_password" });
        return;
      }

      const deleted = await repository.resetData();
      res.json({
        ok: true,
        deleted,
        preserved: ["users", "roles", "permissions", "user_permissions", "survey_questions", "initial_balances"],
      });
    } catch (error) {
      if (error instanceof DevResetValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  return router;
}

export const adminDevRouter = createAdminDevRouter();

class DevResetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DevResetValidationError";
  }
}

function parsePassword(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new DevResetValidationError("invalid_body");
  }

  const password = (body as { password?: unknown }).password;
  if (typeof password !== "string" || password.length === 0) {
    throw new DevResetValidationError("invalid_reset_password");
  }

  return password;
}
