import { Router, type RequestHandler } from "express";
import { requireAuth, requireRole } from "../auth/middleware";
import { postgresAchievementsRepository, type AchievementsRepository } from "./repository";

export function createAchievementsRouter(
  repository: AchievementsRepository = postgresAchievementsRepository,
  authMiddleware: RequestHandler = requireAuth
): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get("/", async (req, res, next) => {
    try {
      res.json({ achievements: await repository.listVisible(req.user.id) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/secret-reveals", async (req, res, next) => {
    try {
      res.json({ achievements: await repository.listPendingSecretReveals(req.user.id) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:key/revealed", async (req, res, next) => {
    try {
      const updated = await repository.markSecretRevealed(req.user.id, req.params.key);
      if (!updated) {
        res.status(404).json({ error: "achievement_not_found" });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function createAdminAchievementsRouter(
  repository: AchievementsRepository = postgresAchievementsRepository,
  authMiddleware: RequestHandler = requireAuth
): Router {
  const router = Router();

  router.get("/achievements", authMiddleware, requireRole("admin"), async (_req, res, next) => {
    try {
      res.json({ achievements: await repository.listAdmin() });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const achievementsRouter = createAchievementsRouter();
export const adminAchievementsRouter = createAdminAchievementsRouter();
