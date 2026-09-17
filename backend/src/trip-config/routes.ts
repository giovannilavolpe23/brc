import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import { requireAuth, requireRole } from "../auth/middleware";
import { ClubTimeConfigError, validateClubTimeConfig } from "../time/night-club";
import { postgresTripConfigRepository, type TripConfigRepository } from "./repository";

export function createTripConfigRouter(
  repository: TripConfigRepository = postgresTripConfigRepository,
  authMiddleware: RequestHandler = requireAuth
): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get("/", async (_req, res, next) => {
    try {
      res.json({ config: await repository.getConfig() });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/club-times", requireRole("admin"), async (req, res, next) => {
    try {
      const body = validateClubTimeConfig(parseClubTimesBody(req.body));
      res.json({ config: await repository.updateClubTimes(body) });
    } catch (error) {
      handleTripConfigError(error, res, next);
    }
  });

  return router;
}

export const tripConfigRouter = createTripConfigRouter();

function parseClubTimesBody(body: unknown): { openTime: string; closeTime: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ClubTimeConfigError("invalid_body");
  const record = body as Record<string, unknown>;
  if (typeof record.openTime !== "string") throw new ClubTimeConfigError("invalid_club_open_time");
  if (typeof record.closeTime !== "string") throw new ClubTimeConfigError("invalid_club_close_time");
  return { openTime: record.openTime, closeTime: record.closeTime };
}

function handleTripConfigError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof ClubTimeConfigError) {
    res.status(400).json({ error: error.message });
    return;
  }
  next(error);
}
