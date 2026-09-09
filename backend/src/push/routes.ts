import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import { requireAuth, requireRole } from "../auth/middleware";
import { env } from "../config/env";
import { postgresPushRepository, type PushRepository } from "./repository";
import { pushService, type PushService } from "./service";
import { parsePushSubscriptionInput, PushValidationError } from "./types";

export function createPushRouter(
  repository: PushRepository = postgresPushRepository,
  service: PushService = pushService,
  authMiddleware: RequestHandler = requireAuth,
  adminMiddleware: RequestHandler = requireRole("admin"),
  cronSecret: string = env.cronSecret
): Router {
  const router = Router();

  router.get("/status", authMiddleware, async (req, res, next) => {
    try {
      res.json({
        configured: service.isConfigured(),
        vapidPublicKey: service.publicKey(),
        subscriptionCount: await repository.countSubscriptionsForUser(req.user.id),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/subscribe", authMiddleware, async (req, res, next) => {
    try {
      if (!service.isConfigured()) {
        res.status(503).json({ error: "push_not_configured" });
        return;
      }
      const subscription = parsePushSubscriptionInput(req.body);
      const saved = await repository.upsertSubscription(req.user.id, subscription, req.header("user-agent") || null);
      res.status(201).json({
        subscription: {
          id: saved.id,
          endpoint: saved.endpoint,
          createdAt: saved.createdAt,
          updatedAt: saved.updatedAt,
        },
      });
    } catch (error) {
      handlePushError(error, res, next);
    }
  });

  router.delete("/unsubscribe", authMiddleware, async (req, res, next) => {
    try {
      const subscription = parsePushSubscriptionInput(req.body);
      await repository.deleteSubscription(req.user.id, subscription.endpoint);
      res.status(204).send();
    } catch (error) {
      handlePushError(error, res, next);
    }
  });

  router.post("/test", authMiddleware, adminMiddleware, async (req, res, next) => {
    try {
      if (!service.isConfigured()) {
        res.status(503).json({ error: "push_not_configured" });
        return;
      }
      const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint.trim() : undefined;
      const sent = await service.sendTest(req.user.id, endpoint);
      res.json({ sent });
    } catch (error) {
      next(error);
    }
  });

  router.post("/test/global", authMiddleware, adminMiddleware, async (_req, res, next) => {
    try {
      if (!service.isConfigured()) {
        res.status(503).json({ error: "push_not_configured" });
        return;
      }
      res.json(await service.sendGlobalTest());
    } catch (error) {
      next(error);
    }
  });

  router.post("/cron/daily-reminders", async (req, res, next) => {
    try {
      if (!cronSecret || req.header("x-cron-secret") !== cronSecret) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }
      if (!service.isConfigured()) {
        res.status(503).json({ error: "push_not_configured" });
        return;
      }
      res.json(await service.sendDailyReminders());
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const pushRouter = createPushRouter();

function handlePushError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof PushValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }
  next(error);
}
