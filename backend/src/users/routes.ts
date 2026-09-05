import { Router, type RequestHandler } from "express";
import { requireAuth } from "../auth/middleware";
import { parseAppearanceInput, AppearanceValidationError } from "./appearance";
import { postgresAppearanceRepository, type AppearanceRepository } from "./appearance.repository";

export function createUsersRouter(
  repository: AppearanceRepository = postgresAppearanceRepository,
  authMiddleware: RequestHandler = requireAuth
): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get("/me/appearance", async (req, res, next) => {
    try {
      res.json({ appearance: await repository.findByUserId(req.user.id) });
    } catch (error) {
      next(error);
    }
  });

  router.put("/me/appearance", async (req, res, next) => {
    try {
      const appearance = parseAppearanceInput(req.body);
      res.json({ appearance: await repository.upsertForUser(req.user.id, appearance) });
    } catch (error) {
      if (error instanceof AppearanceValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.delete("/me/appearance", async (req, res, next) => {
    try {
      await repository.deleteForUser(req.user.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.put("/:id/appearance", async (req, res, next) => {
    try {
      if (req.params.id !== req.user.id && req.params.id !== req.user.legacyId) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
      const appearance = parseAppearanceInput(req.body);
      res.json({ appearance: await repository.upsertForUser(req.user.id, appearance) });
    } catch (error) {
      if (error instanceof AppearanceValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  return router;
}

export const usersRouter = createUsersRouter();
