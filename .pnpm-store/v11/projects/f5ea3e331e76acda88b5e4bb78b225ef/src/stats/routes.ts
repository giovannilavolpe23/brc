import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import { requireAuth } from "../auth/middleware";
import { DateKeyError, todayInArgentina, validatePastDateKey } from "../dates/trip-date";
import { calculateStats } from "./calculations";
import { postgresStatsRepository, type StatsRepository } from "./repository";

export function createStatsRouter(
  repository: StatsRepository = postgresStatsRepository,
  authMiddleware: RequestHandler = requireAuth,
  now: () => Date = () => new Date()
): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get("/total", async (_req, res, next) => {
    try {
      const todayKey = todayInArgentina(now());
      const data = await repository.loadStatsData(todayKey);
      res.json(calculateStats("total", data));
    } catch (error) {
      next(error);
    }
  });

  router.get("/day/:date", async (req, res, next) => {
    try {
      const currentNow = now();
      const dateKey = validatePastDateKey(req.params.date, currentNow);
      const data = await repository.loadStatsData(todayInArgentina(currentNow));
      res.json(calculateStats("day", data, dateKey));
    } catch (error) {
      handleStatsError(error, res, next);
    }
  });

  return router;
}

export const statsRouter = createStatsRouter();

function handleStatsError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof DateKeyError) {
    res.status(400).json({ error: error.message });
    return;
  }

  next(error);
}
