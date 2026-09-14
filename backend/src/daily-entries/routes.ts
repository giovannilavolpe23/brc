import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import { requireAuth } from "../auth/middleware";
import { evaluateAchievementsThroughDate } from "../achievements/evaluation";
import { DateKeyError, dateKeyDaysBeforeArgentina, validatePastDateKey } from "../dates/trip-date";
import { pushService, type PushService } from "../push/service";
import { postgresDailyEntriesRepository, type DailyEntriesRepository } from "./repository";
import { parseDailyEntryInput, DailyEntryValidationError } from "./validation";

type AfterDailyEntryUpsert = (dateKey: string) => Promise<unknown>;
type AchievementEvaluator = (dateKey: string) => Promise<unknown>;

type DailyEntryFollowUpOptions = {
  now?: () => Date;
  push?: Pick<PushService, "sendDailyRemindersForDate" | "notifyStatsReadyIfComplete">;
  evaluateAchievements?: AchievementEvaluator;
};

export async function runDailyEntryFollowUps(
  dateKey: string,
  {
    now = () => new Date(),
    push = pushService,
    evaluateAchievements = evaluateAchievementsThroughDate,
  }: DailyEntryFollowUpOptions = {}
): Promise<void> {
  if (dateKey === dateKeyDaysBeforeArgentina(1, now())) {
    try {
      await push.sendDailyRemindersForDate(dateKey, "daily-fallback");
    } catch (error) {
      console.warn("Daily reminder fallback failed after daily entry save.", safeFollowUpError(error));
    }
  }

  const results = await Promise.allSettled([
    push.notifyStatsReadyIfComplete(dateKey),
    evaluateAchievements(dateKey),
  ]);
  results.forEach((result) => {
    if (result.status === "rejected") throw result.reason;
  });
}

export function createDailyEntriesRouter(
  repository: DailyEntriesRepository = postgresDailyEntriesRepository,
  authMiddleware: RequestHandler = requireAuth,
  now: () => Date = () => new Date(),
  afterUpsert: AfterDailyEntryUpsert = async (dateKey) => runDailyEntryFollowUps(dateKey, { now })
): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get("/", async (req, res, next) => {
    try {
      res.json({ entries: await repository.listEntries(req.user.id) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:date", async (req, res, next) => {
    try {
      const dateKey = validatePastDateKey(req.params.date, now());
      const entry = await repository.findEntry(req.user.id, dateKey);
      if (!entry) {
        res.status(404).json({ error: "daily_entry_not_found" });
        return;
      }

      res.json({ entry });
    } catch (error) {
      handleDailyEntriesError(error, res, next);
    }
  });

  router.put("/:date", async (req, res, next) => {
    try {
      const dateKey = validatePastDateKey(req.params.date, now());
      const input = parseDailyEntryInput(req.body);
      const entry = await repository.upsertEntry(req.user.id, dateKey, input);
      afterUpsert(dateKey).catch((error) => {
        console.warn("Daily entry saved but follow-up processing failed.", error);
      });
      res.json({ entry });
    } catch (error) {
      handleDailyEntriesError(error, res, next);
    }
  });

  return router;
}

function safeFollowUpError(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== "object") return { message: String(error) };
  const maybeError = error as { name?: unknown; message?: unknown; statusCode?: unknown };
  return {
    name: maybeError.name,
    message: maybeError.message,
    statusCode: maybeError.statusCode,
  };
}

export const dailyEntriesRouter = createDailyEntriesRouter();

function handleDailyEntriesError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof DateKeyError || error instanceof DailyEntryValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }

  next(error);
}
