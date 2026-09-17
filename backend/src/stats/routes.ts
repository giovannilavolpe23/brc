import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import { requireAuth } from "../auth/middleware";
import { DateKeyError, todayInArgentina, validatePastDateKey } from "../dates/trip-date";
import { calculateStats } from "./calculations";
import { postgresStatsRepository, type StatsRepository } from "./repository";
import { postgresTripConfigRepository, type TripConfigRepository } from "../trip-config/repository";

export function createStatsRouter(
  repository: StatsRepository = postgresStatsRepository,
  authMiddleware: RequestHandler = requireAuth,
  now: () => Date = () => new Date(),
  tripConfigRepository: Pick<TripConfigRepository, "getConfig"> = postgresTripConfigRepository
): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get("/total", async (_req, res, next) => {
    try {
      const todayKey = todayInArgentina(now());
      const [data, clubConfig] = await Promise.all([repository.loadStatsData(todayKey), tripConfigRepository.getConfig()]);
      res.json(calculateStats("total", data, undefined, clubConfig));
    } catch (error) {
      next(error);
    }
  });

  router.get("/day/:date", async (req, res, next) => {
    try {
      const currentNow = now();
      const dateKey = validatePastDateKey(req.params.date, currentNow);
      const [data, clubConfig] = await Promise.all([repository.loadStatsData(todayInArgentina(currentNow)), tripConfigRepository.getConfig()]);
      res.json(calculateStats("day", data, dateKey, clubConfig));
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
