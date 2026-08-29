import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import { requireAuth } from "../auth/middleware";
import { DateKeyError, validatePastDateKey } from "../dates/trip-date";
import { postgresSurveysRepository, type SurveysRepository } from "./repository";

class SurveyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SurveyValidationError";
  }
}

export function createSurveysRouter(
  repository: SurveysRepository = postgresSurveysRepository,
  authMiddleware: RequestHandler = requireAuth,
  now: () => Date = () => new Date()
): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get("/", async (_req, res, next) => {
    try {
      res.json({ surveys: await repository.listQuestions() });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:date/my-votes", async (req, res, next) => {
    try {
      const dateKey = validatePastDateKey(req.params.date, now());
      res.json({ votes: await repository.listMyVotes(req.user.id, dateKey) });
    } catch (error) {
      handleSurveysError(error, res, next);
    }
  });

  router.put("/:surveyKey/:date/vote", async (req, res, next) => {
    try {
      const dateKey = validatePastDateKey(req.params.date, now());
      const votedUserIdentifier = parseVotedUserId(req.body);
      if (votedUserIdentifier === req.user.id || votedUserIdentifier === req.user.legacyId) {
        res.status(400).json({ error: "self_vote_not_allowed" });
        return;
      }

      const question = await repository.findQuestionByKey(req.params.surveyKey);
      if (!question) {
        res.status(404).json({ error: "survey_not_found" });
        return;
      }

      const votedUserId = await repository.findActiveUserId(votedUserIdentifier);
      if (!votedUserId) {
        res.status(400).json({ error: "voted_user_not_found" });
        return;
      }

      const vote = await repository.upsertVote(question.key, dateKey, req.user.id, votedUserId);
      res.json({ vote });
    } catch (error) {
      handleSurveysError(error, res, next);
    }
  });

  return router;
}

export const surveysRouter = createSurveysRouter();

function parseVotedUserId(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new SurveyValidationError("invalid_body");
  }

  const votedUserId = (body as { votedUserId?: unknown }).votedUserId;
  if (typeof votedUserId !== "string" || votedUserId.trim() === "") {
    throw new SurveyValidationError("invalid_voted_user_id");
  }

  return votedUserId;
}

function handleSurveysError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof DateKeyError || error instanceof SurveyValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }

  next(error);
}
